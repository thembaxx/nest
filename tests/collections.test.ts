import { test } from "node:test";
import assert from "node:assert/strict";
import { updateCollection, removeCollection } from "../src/lib/collections";
import { makeBookmark, mergeLibrary } from "../src/lib/bookmarks";
import { prepareSyncLibrary } from "../src/lib/sync";
import { seed } from "../src/lib/seed";
import { planLocalCommand, applyPlan, parseModelPlan } from "../src/lib/commands";
import type { Library } from "../src/lib/types";

test("rename normalizes names and rejects a case-insensitive duplicate", () => {
  const original = {
    bookmarks: [],
    lists: [
      { id: "one", name: "Research", color: "blue", updatedAt: 1 },
      { id: "two", name: "Reading", color: "green", updatedAt: 1 },
    ],
  };
  const renamed = updateCollection(original, "one", { name: "  Field   notes ", color: "peach" });
  assert.equal(renamed.lists[0].name, "Field notes");
  assert.equal(renamed.lists[0].color, "peach");
  assert.equal(original.lists[0].name, "Research");
  assert.throws(
    () => updateCollection(original, "one", { name: " READING ", color: "green" }),
    /already exists/,
  );
});
test("removing a collection preserves bookmarks and leaves a sync tombstone", () => {
  const bookmark = makeBookmark("https://example.com", {
    listIds: ["one", "two"],
    note: "Keep",
    favorite: true,
  });
  const removed = removeCollection(
    { bookmarks: [bookmark], lists: [{ id: "one", name: "One", color: "blue", updatedAt: 1 }] },
    "one",
  );
  assert.ok(removed.lists[0].deletedAt);
  assert.deepEqual(removed.bookmarks[0].listIds, ["two"]);
  assert.equal(removed.bookmarks[0].note, "Keep");
  assert.equal(removed.bookmarks[0].id, bookmark.id);
  assert.equal(removed.bookmarks[0].favorite, true);
});
test("personal synced bookmarks take priority over newer sample copies", () => {
  const personal = { ...seed.bookmarks[0], demo: false, note: "My own note", updatedAt: 1 };
  const local = { ...seed, bookmarks: [{ ...seed.bookmarks[0], updatedAt: Date.now() }] };
  for (const [a, b] of [
    [local, { bookmarks: [personal], lists: [] }],
    [{ bookmarks: [personal], lists: [] }, local],
  ])
    assert.equal(mergeLibrary(a, b).bookmarks[0].note, "My own note");
});
test("untouched sample folders cannot overwrite a renamed collection during pairing", () => {
  const local = { ...seed, lists: seed.lists.map((list) => ({ ...list, updatedAt: Date.now() })) };
  const cloud = {
    bookmarks: [],
    lists: [{ ...seed.lists[0], name: "My design archive", updatedAt: 10 }],
  };
  assert.equal(
    mergeLibrary(prepareSyncLibrary(local), cloud).lists.find((list) => list.id === "design")!.name,
    "My design archive",
  );
  const userEdited = { ...local, lists: [{ ...local.lists[0], name: "My real collection" }] };
  assert.ok(prepareSyncLibrary(userEdited).lists[0].updatedAt > 0);
});
test("simple local instructions propose scoped moves and retain metadata when applied", () => {
  const plan = planLocalCommand('Move my design bookmarks to "Project ideas".', seed)!;
  assert.equal(plan.action, "move");
  assert.equal(plan.listName, "Project ideas");
  assert.deepEqual(plan.ids.sort(), ["s2", "s8"]);
  assert.equal(
    seed.lists.some((list) => list.name === "Project ideas"),
    false,
  );
  const applied = applyPlan(seed, plan);
  const collection = applied.lists.find((list) => list.name === "Project ideas")!;
  for (const id of plan.ids) {
    const bookmark = applied.bookmarks.find((item) => item.id === id)!;
    assert.deepEqual(bookmark.listIds, [collection.id]);
    assert.equal(bookmark.title, seed.bookmarks.find((item) => item.id === id)!.title);
    assert.equal(bookmark.demo, false);
  }
});
test("local instructions understand collection names, favorites, and unread selectors", () => {
  assert.equal(
    planLocalCommand('Move all bookmarks from "Design things" to "Research"', seed)!.ids.length,
    5,
  );
  assert.equal(planLocalCommand("Archive my favorites", seed)!.ids.length, 3);
  assert.ok(planLocalCommand("Mark all unread bookmarks as read", seed)!.ids.length > 0);
  assert.equal(planLocalCommand("Move bookmarks except favorites to Research", seed), null);
  assert.equal(planLocalCommand("Move links to Research", seed), null);
  assert.equal(planLocalCommand('Move links from "Missing" to "Research"', seed)!.ids.length, 0);
});
test("plans ignore unknown and deleted IDs rather than mutating unrelated records", () => {
  const bookmark = makeBookmark("https://example.com", { deletedAt: 1 });
  const library: Library = { bookmarks: [bookmark], lists: [] };
  const result = applyPlan(library, {
    action: "favorite",
    ids: [bookmark.id, "invented"],
    explanation: "No",
  });
  assert.equal(result, library);
});

test("model proposals validate action and map only the shown candidate IDs", () => {
  const parsed = parseModelPlan(
    '```json\n{"action":"move","ids":["b0","b0","b99","invented"],"listName":"  Project   ideas  "}\n```',
    ["existing"],
  );
  assert.deepEqual(parsed.ids, ["existing"]);
  assert.equal(parsed.listName, "Project ideas");
  assert.throws(
    () => parseModelPlan('{"action":"delete","ids":["b0"]}', ["existing"]),
    /valid plan/,
  );
  assert.throws(
    () => parseModelPlan('{"action":"move","ids":["b0"]}', ["existing"]),
    /destination collection/,
  );
  assert.throws(() => parseModelPlan("not JSON", ["existing"]), /valid plan/);
});
