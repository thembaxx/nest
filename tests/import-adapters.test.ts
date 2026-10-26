import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsvImport } from "../src/lib/csv-import";
import { parseServiceImport, parseRaindropItems } from "../src/lib/service-import";

test("CSV preserves quoted commas, collections and tags", () => {
  const data = parseCsvImport('url,title,description,tags,folder\nhttps://example.com,"Hello, world","A, B",one;two,Research\n');
  assert.equal(data.bookmarks.length, 1);
  assert.equal(data.bookmarks[0].title, "Hello, world");
  assert.deepEqual(data.bookmarks[0].tags, ["one", "two"]);
  assert.equal(data.lists[0].name, "Research");
  assert.deepEqual(data.bookmarks[0].listIds, [data.lists[0].id]);
});

test("CSV rejects malformed quoted data and missing URL column", () => {
  assert.throws(() => parseCsvImport("title\nHi"), /URL or Link/);
  assert.throws(() => parseCsvImport('url,title\n"https://example.com,Oops'), /unclosed/);
});

test("CSV rejects unsafe URLs", () => {
  assert.equal(parseCsvImport("url\njavascript:alert(1)\nhttps://example.com").bookmarks.length, 1);
});

test("Linkwarden collections retain grouping", () => {
  const data = parseServiceImport({ collections: [{ name: "Read", links: [{ url: "https://example.com", name: "Example" }] }] });
  assert.equal(data?.bookmarks.length, 1);
  assert.equal(data?.lists[0].name, "Read");
});

test("Raindrop items retain title, tags and collection", () => {
  const data = parseRaindropItems([{ link: "https://example.com", title: "Example", tags: ["reading"], collection: { $id: 7 } }], new Map([[7, "Articles"]]));
  assert.equal(data.bookmarks[0].title, "Example");
  assert.deepEqual(data.bookmarks[0].tags, ["reading"]);
  assert.equal(data.lists[0].name, "Articles");
});
