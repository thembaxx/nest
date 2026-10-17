import assert from "node:assert/strict";
import { test } from "node:test";
import { createBackup, encryptedBackup, personalLibrary, readBackup } from "../src/lib/backup";
import { makeBookmark, mergeLibrary, parseImport } from "../src/lib/bookmarks";
import { decryptData, encryptData, importRecoveryKey, recoveryKey } from "../src/lib/encryption";
import { seed } from "../src/lib/seed";
import { defaultSettings } from "../src/lib/types";

const bookmark = makeBookmark("https://example.com/private", {
  id: "personal",
  title: "Private field notes",
  note: "A personal note",
  tags: ["keep"],
  listIds: ["notes"],
  createdAt: 10,
  updatedAt: 20,
});
const library = {
  bookmarks: [bookmark, { ...bookmark, id: "trash", deletedAt: 30, updatedAt: 30 }],
  lists: [{ id: "notes", name: "Field notes", color: "sage", updatedAt: 15 }],
};

test("backups preserve IDs, notes, trash and preferences without device credentials or samples", async () => {
  const backup = createBackup(
    {
      bookmarks: [...seed.bookmarks, ...library.bookmarks],
      lists: [...seed.lists, ...library.lists],
    },
    {
      ...defaultSettings,
      theme: "dark",
      syncKey: "server-secret",
      driveKey: "drive-secret",
      drivePendingKey: "pending-secret",
      driveDeviceId: "device",
      model: "local-model",
    },
  );
  const text = JSON.stringify(backup);
  for (const secret of ["server-secret", "drive-secret", "pending-secret", "device", "local-model"])
    assert.ok(!text.includes(secret));
  const restored = await readBackup(text, "");
  assert.deepEqual(restored.library, library);
  assert.equal(restored.preferences?.theme, "dark");
  assert.equal(restored.library.bookmarks[1].deletedAt, 30);
});

test("password-encrypted backups round-trip and reject wrong passwords and modified ciphertext", async () => {
  const encrypted = await encryptedBackup(library, defaultSettings, "my long backup password");
  const text = JSON.stringify(encrypted);
  assert.ok(!text.includes(bookmark.url));
  assert.ok(!text.includes(bookmark.note!));
  assert.deepEqual((await readBackup(text, "my long backup password")).library, library);
  await assert.rejects(readBackup(text, "an incorrect password"), /Could not open/);
  const damaged = {
    ...encrypted,
    ciphertext: (encrypted.ciphertext[0] === "A" ? "B" : "A") + encrypted.ciphertext.slice(1),
  };
  await assert.rejects(readBackup(JSON.stringify(damaged), "my long backup password"));
  await assert.rejects(encryptedBackup(library, defaultSettings, "short"), /12 characters/);
});

test("restore supports old JSON and validates versions, unsafe URLs and KDF cost before use", async () => {
  assert.deepEqual((await readBackup(JSON.stringify(library), "")).library, library);
  await assert.rejects(
    readBackup(JSON.stringify({ ...createBackup(library, defaultSettings), version: 2 }), ""),
  );
  await assert.rejects(
    readBackup(
      JSON.stringify({ bookmarks: [{ ...bookmark, url: "javascript:alert(1)" }], lists: [] }),
      "",
    ),
  );
  await assert.rejects(
    readBackup(
      JSON.stringify({
        format: "nest-encrypted",
        kdf: { name: "PBKDF2-SHA256", iterations: 1e12, salt: "A".repeat(22) + "==" },
      }),
      "a long backup password",
    ),
  );
});

test("full JSON backups also import through the existing browser-import flow without reviving trash", () => {
  const imported = parseImport(
    JSON.stringify(createBackup(library, defaultSettings)),
    "backup.json",
  );
  assert.equal(imported.bookmarks.length, 1);
  assert.equal(imported.bookmarks[0].note, bookmark.note);
  assert.equal(imported.lists[0].name, "Field notes");
  assert.throws(() =>
    parseImport(JSON.stringify({ format: "nest-backup", version: 2 }), "backup.json"),
  );
});

test("restoring an older backup keeps newer edits, deletions and bookmarks already on the device", async () => {
  const newer = { ...bookmark, note: "A newer note", updatedAt: 50 };
  const deleted = { ...library.bookmarks[1], updatedAt: 60, deletedAt: 60 };
  const extra = makeBookmark("https://example.org/extra", { id: "extra" });
  const restored = await readBackup(JSON.stringify(createBackup(library, defaultSettings)), "");
  const merged = mergeLibrary({ bookmarks: [newer, deleted, extra], lists: [] }, restored.library);
  assert.equal(merged.bookmarks.find((item) => item.id === "personal")?.note, "A newer note");
  assert.equal(merged.bookmarks.find((item) => item.id === "trash")?.deletedAt, 60);
  assert.ok(merged.bookmarks.some((item) => item.id === "extra"));
  assert.deepEqual(personalLibrary(seed), { bookmarks: [], lists: [] });
});

test("Drive encryption uses fresh IVs, authenticates data and separates backup and sync contexts", async () => {
  const key = await importRecoveryKey(recoveryKey());
  const first = await encryptData(library, key, "drive");
  const second = await encryptData(library, key, "drive");
  assert.notEqual(first.iv, second.iv);
  assert.deepEqual(await decryptData(first, key, "drive"), library);
  await assert.rejects(decryptData(first, await importRecoveryKey(recoveryKey()), "drive"));
  await assert.rejects(decryptData(first, key, "backup"));
});
