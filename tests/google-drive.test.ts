import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { syncGoogleDrive, GoogleDriveError, activeSyncProvider } from "../src/lib/google-drive";
import { createBackup, parseBackup } from "../src/lib/backup";
import { makeBookmark } from "../src/lib/bookmarks";
import { defaultSettings } from "../src/lib/types";

const firstDevice = "11111111-1111-4111-8111-111111111111";
const secondDevice = "22222222-2222-4222-8222-222222222222";
function drive(t: TestContext) {
  const files = new Map<string, { id: string; name: string; content: string }>();
  let device = firstDevice;
  let writes = 0;
  let failStatus = 0;
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: () => device,
      setItem: () => {},
    },
  });
  t.after(() => {
    if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator);
    Reflect.deleteProperty(globalThis, "sessionStorage");
  });
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    const url = new URL(input);
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-token");
    assert.ok(!url.searchParams.has("access_token"));
    if (failStatus) return new Response("Failed", { status: failStatus });
    if (url.pathname.startsWith("/upload/")) {
      writes++;
      if (init.method === "POST") {
        const body = await (init.body as Blob).text();
        const parts = body
          .split(/--nest-[a-f0-9-]+/)
          .filter((part) => part.includes("Content-Type"));
        const metadata = JSON.parse(parts[0].split("\r\n\r\n")[1].trim());
        assert.deepEqual(metadata.parents, ["appDataFolder"]);
        assert.deepEqual(metadata.appProperties, { application: "nest" });
        const id = `file-${files.size + 1}`;
        files.set(id, { id, name: metadata.name, content: parts[1].split("\r\n\r\n")[1].trim() });
        return Response.json({ id });
      }
      const file = files.get(url.pathname.split("/").pop()!)!;
      file.content = String(init.body);
      return Response.json({ id: file.id });
    }
    if (url.searchParams.has("spaces")) {
      assert.equal(url.searchParams.get("spaces"), "appDataFolder");
      return Response.json({
        files: [...files.values()].map(({ id, name, content }) => ({
          id,
          name,
          size: String(content.length),
        })),
      });
    }
    return new Response(files.get(url.pathname.split("/").pop()!)!.content);
  });
  return {
    files,
    writes: () => writes,
    device: (id: string) => {
      device = id;
    },
    fail: (status: number) => {
      failStatus = status;
    },
  };
}

test("Drive creates private app-data snapshots and avoids uploading an unchanged library", async (t) => {
  const server = drive(t);
  const library = { bookmarks: [makeBookmark("https://example.com")], lists: [] };
  assert.deepEqual(await syncGoogleDrive("test-token", library), library);
  assert.equal(server.writes(), 1);
  const stored = [...server.files.values()][0];
  assert.equal(stored.name, `nest-library-${firstDevice}.json`);
  assert.deepEqual(parseBackup(stored.content).library, library);
  await syncGoogleDrive("test-token", library);
  assert.equal(server.writes(), 1);
});

test("two devices retain offline additions, edits, and deletion tombstones in separate files", async (t) => {
  const server = drive(t);
  const a = makeBookmark("https://example.com/a", { updatedAt: 10 });
  const b = makeBookmark("https://example.com/b", { updatedAt: 10 });
  const initialA = { bookmarks: [a], lists: [] };
  const initialB = { bookmarks: [b], lists: [] };
  await syncGoogleDrive("test-token", initialA);
  server.device(secondDevice);
  const combined = await syncGoogleDrive("test-token", initialB);
  assert.equal(combined.bookmarks.length, 2);
  const removedB = { ...b, deletedAt: 30, updatedAt: 30 };
  await syncGoogleDrive("test-token", { bookmarks: [a, removedB], lists: [] });
  const secondFile = [...server.files.values()].find((file) => file.name.includes(secondDevice))!;
  const secondContent = secondFile.content;
  server.device(firstDevice);
  const newA = { ...a, note: "Offline edit", updatedAt: 40 };
  const result = await syncGoogleDrive("test-token", { bookmarks: [newA], lists: [] });
  assert.equal(result.bookmarks.find((record) => record.id === b.id)?.deletedAt, 30);
  assert.equal(result.bookmarks.find((record) => record.id === a.id)?.note, "Offline edit");
  assert.equal(secondFile.content, secondContent);
  assert.equal(server.files.size, 2);
});

test("invalid cloud data, expired authorization, and quota failures never overwrite snapshots", async (t) => {
  const server = drive(t);
  const library = { bookmarks: [], lists: [] };
  server.files.set("broken", {
    id: "broken",
    name: `nest-library-${secondDevice}.json`,
    content: "bad JSON",
  });
  await assert.rejects(syncGoogleDrive("test-token", library), /not valid JSON/);
  assert.equal(server.writes(), 0);
  for (const status of [401, 403, 429]) {
    server.fail(status);
    await assert.rejects(
      syncGoogleDrive("test-token", library),
      (error: unknown) => error instanceof GoogleDriveError && error.status === status,
    );
  }
  assert.equal(server.writes(), 0);
});

test("existing recovery-key settings retain their provider until the user explicitly disconnects", () => {
  assert.equal(activeSyncProvider({ ...defaultSettings, syncKey: "existing-key" }), "nest");
  assert.equal(
    activeSyncProvider({ ...defaultSettings, syncKey: "existing-key", syncProvider: "google" }),
    "google",
  );
  assert.equal(
    activeSyncProvider({ ...defaultSettings, syncKey: "existing-key", syncProvider: "local" }),
    "local",
  );
  assert.doesNotThrow(() => createBackup({ bookmarks: [], lists: [] }));
});
