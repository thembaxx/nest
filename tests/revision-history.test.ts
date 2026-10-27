import test from "node:test";
import assert from "node:assert/strict";
import { makeBookmark, mergeLibrary } from "../src/lib/bookmarks";
import type { BookmarkList, Library } from "../src/lib/types";
import {
  captureRevisions,
  MAX_HISTORY_BYTES,
  MAX_REVISIONS,
  parseRevisionHistory,
  previewRevision,
  restoreRevision,
} from "../src/lib/revision-history";

const bookmark = makeBookmark("https://example.com/article", {
  id: "bookmark-1",
  title: "Original title",
  note: "My original note",
  createdAt: 1,
  updatedAt: 10,
});
const collection: BookmarkList = {
  id: "collection-1",
  name: "Reading",
  color: "lilac",
  updatedAt: 10,
};
const local: Library = { bookmarks: [bookmark], lists: [collection] };
const incoming: Library = {
  bookmarks: [{ ...bookmark, title: "Other device title", note: "Other note", updatedAt: 20 }],
  lists: [{ ...collection, name: "Weekend", updatedAt: 20 }],
};

test("losing bookmark and collection revisions are captured around a merge", () => {
  const merged = mergeLibrary(local, incoming);
  const history = captureRevisions([], local, incoming, merged, 100);
  assert.equal(history.length, 2);
  assert.deepEqual(history.find((entry) => entry.kind === "bookmark")?.record, bookmark);
  assert.deepEqual(history.find((entry) => entry.kind === "collection")?.record, collection);
  assert.deepEqual(local.bookmarks[0], bookmark);
});

test("capture is deterministic, order-independent and idempotent", () => {
  const merged = mergeLibrary(local, incoming);
  const history = captureRevisions([], local, incoming, merged, 100);
  assert.deepEqual(captureRevisions([], incoming, local, merged, 100), history);
  assert.deepEqual(captureRevisions(history, local, incoming, merged, 200), history);
  const reordered = { ...bookmark, tags: [], title: "Original title" };
  assert.deepEqual(
    captureRevisions(history, { ...local, bookmarks: [reordered] }, incoming, merged, 200),
    history,
  );
});

test("same content with a newer timestamp and untouched sample conflicts need no history", () => {
  const newer = { ...local, bookmarks: [{ ...bookmark, updatedAt: 30 }] };
  assert.equal(captureRevisions([], local, newer, mergeLibrary(local, newer), 100).length, 0);
  const sample = { ...bookmark, demo: true, updatedAt: 50, note: "Sample" };
  const samples = { bookmarks: [sample], lists: [] };
  const personal = { bookmarks: [bookmark], lists: [] };
  assert.equal(
    captureRevisions([], samples, personal, mergeLibrary(samples, personal), 100).length,
    0,
  );
});

test("preview names changed fields without modifying anything", () => {
  const merged = mergeLibrary(local, incoming);
  const revision = captureRevisions([], local, incoming, merged, 100).find(
    (r) => r.kind === "bookmark",
  )!;
  const preview = previewRevision(revision, merged);
  assert.equal(preview.label, "Original title");
  assert.deepEqual(preview.changedFields, ["note", "title"]);
  assert.ok("title" in preview.saved);
  preview.saved.title = "Changed preview";
  assert.equal(revision.record.title, "Original title");
  assert.equal(merged.bookmarks[0].title, "Other device title");
});

test("restoring either record keeps its ID and beats the current device timestamp", () => {
  const merged = mergeLibrary(local, incoming);
  const history = captureRevisions([], local, incoming, merged, 100);
  const oldBookmark = history.find((r) => r.kind === "bookmark")!;
  const oldCollection = history.find((r) => r.kind === "collection")!;
  const restored = restoreRevision(restoreRevision(merged, oldBookmark, 5), oldCollection, 5);
  assert.equal(restored.bookmarks[0].id, bookmark.id);
  assert.equal(restored.bookmarks[0].note, bookmark.note);
  assert.equal(restored.bookmarks[0].updatedAt, 21);
  assert.equal(restored.lists[0].id, collection.id);
  assert.equal(restored.lists[0].name, collection.name);
  assert.equal(restored.lists[0].updatedAt, 21);
  assert.equal(mergeLibrary(merged, restored).bookmarks[0].title, "Original title");
});

test("active snapshots can recover tombstones without silently deleting collection history", () => {
  const deleted = {
    bookmarks: [{ ...bookmark, updatedAt: 50, deletedAt: 50 }],
    lists: [{ ...collection, updatedAt: 50, deletedAt: 50 }],
  };
  const history = captureRevisions([], local, deleted, mergeLibrary(local, deleted), 100);
  const entry = history.find((r) => r.kind === "bookmark")!;
  assert.equal(previewRevision(entry, deleted).willDelete, false);
  const restored = restoreRevision(deleted, entry, 200);
  assert.equal(restored.bookmarks[0].deletedAt, undefined);
  assert.equal(restored.lists[0].deletedAt, 50);
  assert.equal(restored.bookmarks[0].updatedAt, 200);
});

test("history validates records, strips unrelated fields and rejects corrupt storage", () => {
  const merged = mergeLibrary(local, incoming);
  const [entry] = captureRevisions([], local, incoming, merged, 100).filter(
    (r) => r.kind === "bookmark",
  );
  const withSecrets = {
    ...entry,
    settings: { syncKey: "never-save-this" },
    record: { ...entry.record, driveKey: "never-save-that" },
  };
  const validated = parseRevisionHistory(
    JSON.stringify([withSecrets, null, { ...entry, version: 2 }]),
  );
  assert.equal(validated.length, 1);
  assert.doesNotMatch(JSON.stringify(validated), /never-save|syncKey|driveKey/);
  for (const raw of [null, {}, "broken json", [{ ...entry, record: { id: "bad" } }]]) {
    assert.deepEqual(parseRevisionHistory(raw), []);
  }
  assert.deepEqual(parseRevisionHistory(" ".repeat(MAX_HISTORY_BYTES + 1)), []);
});

test("history is bounded and keeps the newest distinct revisions", () => {
  const raw = Array.from({ length: MAX_REVISIONS + 30 }, (_, index) => ({
    version: 1,
    kind: "bookmark",
    capturedAt: index,
    record: { ...bookmark, title: `Version ${index}`, updatedAt: index },
  }));
  const history = parseRevisionHistory(raw);
  assert.equal(history.length, MAX_REVISIONS);
  assert.equal(history[0].capturedAt, MAX_REVISIONS + 29);
  assert.ok(new TextEncoder().encode(JSON.stringify(history)).byteLength <= MAX_HISTORY_BYTES);
});

test("unsafe restore timestamps and unvalidated history cannot be applied", () => {
  const merged = mergeLibrary(local, incoming);
  const [entry] = captureRevisions([], local, incoming, merged, 100);
  assert.throws(() => restoreRevision(merged, entry, NaN), /time/);
  assert.throws(() => restoreRevision(merged, entry, Number.MAX_VALUE), /timestamp/);
  assert.throws(() => restoreRevision(merged, { ...entry, version: 2 } as never), /invalid/);
});
