import { test } from "node:test";
import assert from "node:assert/strict";
import { createBackup, parseBackup, restoreLibrary } from "../src/lib/backup";
import { makeBookmark, mergeLibrary, parseImport } from "../src/lib/bookmarks";
import { defaultSettings } from "../src/lib/types";
import { seed } from "../src/lib/seed";

test("portable backups round-trip metadata, empty collections, and tombstones without credentials or samples", () => {
  const bookmark = makeBookmark("https://example.com/notes", {
    note: "Private notes",
    tags: ["reading"],
    favorite: true,
    read: true,
    archived: true,
    listIds: ["folder"],
    deletedAt: 20,
    updatedAt: 20,
  });
  const lists = [
    { id: "folder", name: "Research", color: "green", updatedAt: 10 },
    { id: "empty", name: "Empty", color: "blue", updatedAt: 10 },
    { id: "removed", name: "Removed", color: "blue", updatedAt: 20, deletedAt: 20 },
  ];
  const text = createBackup(
    { bookmarks: [bookmark, seed.bookmarks[0]], lists },
    {
      ...defaultSettings,
      theme: "dark",
      autoSort: false,
      syncKey: "secret-recovery-key",
      model: "device-model",
      syncProvider: "google",
    },
  );
  const backup = parseBackup(text);
  assert.deepEqual(backup.library, { bookmarks: [bookmark], lists });
  assert.deepEqual(backup.preferences, {
    theme: "dark",
    autoSort: false,
    healthChecks: true,
    effects: true,
  });
  for (const secret of [
    "secret-recovery-key",
    "syncKey",
    "syncProvider",
    "device-model",
    "access_token",
  ])
    assert.ok(!text.includes(secret));
  assert.throws(() => parseImport(text, "backup.json"), /Settings/);
});

test("restore keeps stable IDs, newer local edits, and removals across repeated restores", () => {
  const original = makeBookmark("https://example.com/a", { updatedAt: 10, note: "Old" });
  const local = { bookmarks: [{ ...original, note: "New", updatedAt: 30 }], lists: [] };
  const removed = makeBookmark("https://example.com/b", { updatedAt: 40, deletedAt: 40 });
  const backup = { bookmarks: [original, removed], lists: [] };
  const restored = restoreLibrary(local, backup);
  assert.equal(restored.bookmarks.length, 2);
  assert.equal(restored.bookmarks[0].note, "New");
  assert.equal(restored.bookmarks[1].deletedAt, 40);
  assert.deepEqual(restoreLibrary(restored, backup), restored);
  assert.equal(
    restoreLibrary(
      { bookmarks: [{ ...removed, deletedAt: undefined, updatedAt: 5 }], lists: [] },
      backup,
    ).bookmarks[0].deletedAt,
    40,
  );
});

test("legacy Nest exports restore without inventing settings; unsafe and future backups are rejected", () => {
  const library = { bookmarks: [makeBookmark("https://example.com")], lists: [] };
  assert.deepEqual(parseBackup(JSON.stringify(library)), { library });
  assert.throws(() => parseBackup("bad JSON"), /valid JSON/);
  assert.throws(
    () => parseBackup(JSON.stringify({ format: "nest-backup", version: 2, ...library })),
    /not supported/,
  );
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          bookmarks: [{ ...library.bookmarks[0], url: "javascript:alert(1)" }],
          lists: [],
        }),
      ),
    /Nest JSON backup/,
  );
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({ bookmarks: [library.bookmarks[0], library.bookmarks[0]], lists: [] }),
      ),
    /duplicate record IDs/,
  );
  assert.throws(() => parseBackup(JSON.stringify({ roots: {} })), /Browser exports/);
});

test("equal-timestamp edits converge in both directions, and a removal wins an exact clock tie", () => {
  const bookmark = makeBookmark("https://example.com", { updatedAt: 10 });
  const a = { bookmarks: [{ ...bookmark, note: "A" }], lists: [] };
  const b = { bookmarks: [{ ...bookmark, note: "B" }], lists: [] };
  assert.deepEqual(mergeLibrary(a, b), mergeLibrary(b, a));
  const removed = { bookmarks: [{ ...bookmark, deletedAt: 10 }], lists: [] };
  assert.equal(mergeLibrary(a, removed).bookmarks[0].deletedAt, 10);
  assert.equal(mergeLibrary(removed, a).bookmarks[0].deletedAt, 10);
});
