import assert from "node:assert/strict";
import { test, mock } from "node:test";
import {
  syncGoogleDrive,
  DriveAuthError,
  activeSyncProvider,
  DriveRequestError,
} from "../src/lib/google-drive";
import { makeBookmark } from "../src/lib/bookmarks";
import { encryptData, importRecoveryKey, recoveryKey } from "../src/lib/encryption";
import { defaultSettings, type Library } from "../src/lib/types";

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

test("upgrades honor an explicit local or Google provider even when a legacy server key is saved", () => {
  const old = { ...defaultSettings, syncKey: "old-server-key" };
  assert.equal(activeSyncProvider(old), "nest");
  assert.equal(activeSyncProvider({ ...old, syncProvider: "local" }), "local");
  assert.equal(activeSyncProvider({ ...old, syncProvider: "google" }), "google");
  assert.equal(activeSyncProvider({ ...old, driveKey: recoveryKey() }), "google");
});

test("permission and quota errors retain HTTP status for retry backoff and never upload", async () => {
  const drive = fakeDrive();
  try {
    for (const status of [403, 429]) {
      const failed = mock.method(globalThis, "fetch", async () => new Response(null, { status }));
      try {
        await assert.rejects(
          sync(recoveryKey(), "phone", empty),
          (error: unknown) => error instanceof DriveRequestError && error.status === status,
        );
      } finally {
        failed.mock.restore();
      }
    }
    assert.equal(drive.writes.length, 0);
  } finally {
    drive.restore();
  }
});

test("pairing at the snapshot limit cannot strand existing devices; their updates still sync", async () => {
  const drive = fakeDrive();
  try {
    const key = recoveryKey();
    const data = await encryptData(empty, await importRecoveryKey(key), "drive");
    for (let index = 0; index < 200; index++) {
      const id = `file${index}`;
      drive.files.set(id, { id, name: `nest-sync-v1-device${index}.json`, data });
    }
    await assert.rejects(sync(key, "new-device", empty), /device snapshot limit/);
    assert.equal(drive.files.size, 200);
    assert.equal(drive.writes.length, 0);

    const bookmark = makeBookmark("https://example.org/still-syncs", { id: "existing-device" });
    const updated = await sync(key, "device0", { bookmarks: [bookmark], lists: [] });
    assert.deepEqual(updated.bookmarks, [bookmark]);
    assert.deepEqual(drive.writes, ["file0"]);
    assert.equal(drive.files.size, 200);
  } finally {
    drive.restore();
  }
});

test("cyclic and unbounded empty Drive listings fail without any upload", async () => {
  const drive = fakeDrive();
  try {
    for (const repeats of [true, false]) {
      let requests = 0;
      const listing = mock.method(globalThis, "fetch", async () => {
        requests++;
        return Response.json({
          files: [],
          nextPageToken: repeats ? "repeated" : `page${requests}`,
        });
      });
      try {
        await assert.rejects(sync(recoveryKey(), "phone", empty), /incomplete file listing/);
        assert.equal(requests, repeats ? 2 : 201);
        assert.equal(drive.writes.length, 0);
      } finally {
        listing.mock.restore();
      }
    }
  } finally {
    drive.restore();
  }
});

test("retry after losing a committed PATCH response preserves deletions and concurrent revisions", async () => {
  const drive = fakeDrive();
  try {
    const key = recoveryKey();
    const original = makeBookmark("https://example.org/changed", {
      id: "changed",
      updatedAt: 10,
      note: "Original note",
    });
    const removed = makeBookmark("https://example.org/removed", {
      id: "removed",
      updatedAt: 10,
    });
    const initial = { bookmarks: [original, removed], lists: [] };
    await sync(key, "phone", initial);
    const laptop = await sync(key, "laptop", initial);
    const tombstone = { ...removed, updatedAt: 20, deletedAt: 20 };
    const phone = { bookmarks: [original, tombstone], lists: [] };

    const originalFetch = globalThis.fetch;
    const lostResponse = mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        const response = await originalFetch(input, init);
        if (init?.method === "PATCH") throw new TypeError("Network response lost after commit");
        return response;
      },
    );
    try {
      await assert.rejects(sync(key, "phone", phone), /response lost/);
    } finally {
      lostResponse.mock.restore();
    }

    // Another device edits a separate record while retaining an older live copy
    // of the removed bookmark. Neither that copy nor a retry may resurrect it.
    const changed = { ...original, updatedAt: 30, note: "Edited on laptop" };
    const laptopResult = await sync(key, "laptop", {
      ...laptop,
      bookmarks: [changed, removed],
    });
    const recovered = await sync(key, "phone", phone);
    assert.deepEqual(recovered, laptopResult);
    assert.equal(recovered.bookmarks.find((bookmark) => bookmark.id === "removed")?.deletedAt, 20);
    assert.equal(
      recovered.bookmarks.find((bookmark) => bookmark.id === "changed")?.note,
      changed.note,
    );
    assert.equal(drive.files.size, 2, "retry reuses each device's existing snapshot");
    const writes = drive.writes.length;
    await sync(key, "phone", recovered);
    assert.equal(
      drive.writes.length,
      writes,
      "a recovered unchanged snapshot is not uploaded again",
    );
  } finally {
    drive.restore();
  }
});
