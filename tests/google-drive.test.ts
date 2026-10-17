import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { syncGoogleDrive, DriveAuthError } from "../src/lib/google-drive";
import { makeBookmark } from "../src/lib/bookmarks";
import { encryptData, importRecoveryKey, recoveryKey } from "../src/lib/encryption";
import type { Library } from "../src/lib/types";

const empty: Library = { bookmarks: [], lists: [] };
const session = { accessToken: "ephemeral-google-token", expiresAt: Date.now() + 3600000 };
type Snapshot = { id: string; name: string; data: unknown };
function fakeDrive() {
  const files = new Map<string, Snapshot>();
  const writes: string[] = [];
  const requests: { url: string; headers: Headers; body: string }[] = [];
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "locks");
  // Each call represents an independent device with its own browser lock manager.
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, options: { signal: AbortSignal }, callback: () => unknown) => {
        options.signal.throwIfAborted();
        return callback();
      },
    },
  });
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const body = String(init?.body || "");
      const headers = new Headers(init?.headers);
      requests.push({ url: url.href, headers, body });
      assert.equal(headers.get("Authorization"), `Bearer ${session.accessToken}`);
      if (init?.method === "POST") {
        const boundary = headers.get("content-type")!.split("boundary=")[1];
        const parts = body.split(`--${boundary}`);
        const metadata = JSON.parse(parts[1].split("\r\n\r\n")[1].trim());
        assert.deepEqual(metadata.parents, ["appDataFolder"]);
        assert.deepEqual(metadata.appProperties, { nestSync: "v1" });
        const data = JSON.parse(parts[2].split("\r\n\r\n")[1].trim());
        const id = `file${files.size + 1}`;
        files.set(id, { id, name: metadata.name, data });
        writes.push(id);
        return Response.json({ id });
      }
      if (init?.method === "PATCH") {
        const id = url.pathname.split("/").at(-1)!;
        files.get(id)!.data = JSON.parse(body);
        writes.push(id);
        return Response.json({ id });
      }
      if (url.searchParams.get("alt") === "media")
        return Response.json(files.get(url.pathname.split("/").at(-1)!)!.data);
      assert.equal(url.searchParams.get("spaces"), "appDataFolder");
      return Response.json({ files: [...files.values()].map(({ id, name }) => ({ id, name })) });
    },
  );
  return {
    files,
    writes,
    requests,
    restore: () => {
      fetch.mock.restore();
      if (descriptor) Object.defineProperty(navigator, "locks", descriptor);
      else Reflect.deleteProperty(navigator, "locks");
    },
  };
}
const sync = (key: string, device: string, library: Library) =>
  syncGoogleDrive(session, key, device, library, new AbortController().signal);

test("two devices converge after simultaneous edits; deletion tombstones survive an old offline copy", async () => {
  const drive = fakeDrive();
  try {
    const key = recoveryKey();
    const one = makeBookmark("https://example.org/one", {
      id: "one",
      updatedAt: 10,
      note: "Private note",
    });
    const two = makeBookmark("https://example.org/two", { id: "two", updatedAt: 20 });
    await Promise.all([
      sync(key, "phone", { bookmarks: [one], lists: [] }),
      sync(key, "laptop", { bookmarks: [two], lists: [] }),
    ]);
    assert.equal(drive.files.size, 2);
    const phone = await sync(key, "phone", { bookmarks: [one], lists: [] });
    const laptop = await sync(key, "laptop", { bookmarks: [two], lists: [] });
    assert.deepEqual(new Set(phone.bookmarks.map((item) => item.id)), new Set(["one", "two"]));
    assert.deepEqual(phone, laptop);
    const deleted = { ...one, updatedAt: 30, deletedAt: 30 };
    await sync(key, "phone", { ...phone, bookmarks: [deleted, two] });
    const restoredDevice = await sync(key, "tablet", { bookmarks: [one], lists: [] });
    assert.equal(restoredDevice.bookmarks.find((item) => item.id === "one")?.deletedAt, 30);
    for (const request of drive.requests) {
      assert.ok(!request.body.includes(one.url));
      assert.ok(!request.body.includes("Private note"));
      assert.ok(!request.body.includes(key));
      assert.ok(!request.url.includes(key));
    }
    const writes = drive.writes.length;
    await sync(key, "tablet", restoredDevice);
    assert.equal(drive.writes.length, writes, "unchanged libraries do not upload again");
  } finally {
    drive.restore();
  }
});

test("wrong keys and a corrupted device snapshot fail before any Drive write", async () => {
  const drive = fakeDrive();
  try {
    const key = recoveryKey();
    await sync(key, "phone", empty);
    const before = JSON.stringify([...drive.files]);
    await assert.rejects(sync(recoveryKey(), "tablet", empty), /original recovery key/);
    assert.equal(JSON.stringify([...drive.files]), before);
    drive.files.set("broken", {
      id: "broken",
      name: "nest-sync-v1-broken.json",
      data: { invalid: true },
    });
    const writes = drive.writes.length;
    await assert.rejects(
      sync(key, "phone", { bookmarks: [makeBookmark("https://example.com")], lists: [] }),
    );
    assert.equal(drive.writes.length, writes);
  } finally {
    drive.restore();
  }
});

test("Drive listing follows pagination and restores every device before uploading", async () => {
  const drive = fakeDrive();
  try {
    const key = recoveryKey();
    const cryptoKey = await importRecoveryKey(key);
    const one = makeBookmark("https://example.com/a", { id: "a" });
    const two = makeBookmark("https://example.com/b", { id: "b" });
    drive.files.set("a", {
      id: "a",
      name: "first",
      data: await encryptData({ bookmarks: [one], lists: [] }, cryptoKey, "drive"),
    });
    drive.files.set("b", {
      id: "b",
      name: "second",
      data: await encryptData({ bookmarks: [two], lists: [] }, cryptoKey, "drive"),
    });
    const original = globalThis.fetch;
    const paginated = mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.pathname === "/drive/v3/files")
          return Response.json(
            url.searchParams.has("pageToken")
              ? { files: [{ id: "b", name: "second" }] }
              : { files: [{ id: "a", name: "first" }], nextPageToken: "next-page" },
          );
        return original(input, init);
      },
    );
    try {
      assert.equal((await sync(key, "new-device", empty)).bookmarks.length, 2);
    } finally {
      paginated.mock.restore();
    }
  } finally {
    drive.restore();
  }
});

test("expired authorization and cancellation never upload", async () => {
  const drive = fakeDrive();
  try {
    await assert.rejects(
      syncGoogleDrive(
        { ...session, expiresAt: 0 },
        recoveryKey(),
        "phone",
        empty,
        new AbortController().signal,
      ),
      DriveAuthError,
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      syncGoogleDrive(session, recoveryKey(), "phone", empty, controller.signal),
    );
    assert.equal(drive.writes.length, 0);
  } finally {
    drive.restore();
  }
});
