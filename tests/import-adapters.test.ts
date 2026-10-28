import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsvImport } from "../src/lib/csv-import";
import { canonicalUrl, makeBookmark } from "../src/lib/bookmarks";
import { ingestBookmarks } from "../src/lib/organize";
import { asXImport, isXPostUrl } from "../src/lib/x-import";
import { createBackup, parseBackup } from "../src/lib/backup";
import { defaultSettings } from "../src/lib/types";
import { parseServiceImport, parseRaindropItems } from "../src/lib/service-import";

test("CSV preserves quoted commas, collections and tags", () => {
  const data = parseCsvImport(
    'url,title,description,tags,folder\nhttps://example.com,"Hello, world","A, B",one;two,Research\n',
  );
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
  const data = parseServiceImport({
    collections: [{ name: "Read", links: [{ url: "https://example.com", name: "Example" }] }],
  });
  assert.equal(data?.bookmarks.length, 1);
  assert.equal(data?.lists[0].name, "Read");
});

test("Raindrop items retain title, tags and collection", () => {
  const data = parseRaindropItems(
    [{ link: "https://example.com", title: "Example", tags: ["reading"], collection: { $id: 7 } }],
    new Map([[7, "Articles"]]),
  );
  assert.equal(data.bookmarks[0].title, "Example");
  assert.deepEqual(data.bookmarks[0].tags, ["reading"]);
  assert.equal(data.lists[0].name, "Articles");
});

test("X CSV exports preserve post text, author, image and imported folders", () => {
  const csv =
    "Tweet_URL,Tweet Text,Author,Handle,Media_URL,Folder\n" +
    'https://x.com/designer/status/123,"A thread about better interfaces, with examples",A Designer,designer,https://pbs.twimg.com/media/example.jpg,Inspiration\n';
  const imported = parseCsvImport(csv);
  assert.equal(imported.bookmarks.length, 1);
  const [bookmark] = imported.bookmarks;
  assert.equal(bookmark.title, "A thread about better interfaces, with examples");
  assert.equal(bookmark.description, "A thread about better interfaces, with examples");
  assert.match(bookmark.note || "", /A Designer.*@designer/);
  assert.equal(bookmark.image, "https://pbs.twimg.com/media/example.jpg");
  assert.deepEqual(imported.bookmarks[0].listIds, [imported.lists[0].id]);
});

test("X exporter without a title still imports post text", () => {
  const csv =
    "author,handle,tweet text,URL,date\n" +
    'Someone,writer,"Saved an interesting post",https://twitter.com/writer/status/321,2026-10-25\n';
  const result = parseCsvImport(csv);
  assert.equal(result.bookmarks.length, 1);
  assert.equal(result.bookmarks[0].title, "Saved an interesting post");
  assert.equal(
    canonicalUrl(result.bookmarks[0].url),
    canonicalUrl("https://x.com/writer/status/321"),
  );
});

test("X-specific metadata is not inferred for ordinary imported websites", () => {
  const imported = parseCsvImport("url,text,author\nhttps://example.com/article,Text,Author\n");
  assert.equal(imported.bookmarks[0].description, "");
  assert.equal(imported.bookmarks[0].note, undefined);
});

test("only explicitly imported X posts are routed to the X library", () => {
  const parsed = parseCsvImport(
    "url,title,folder\n" +
      "https://twitter.com/author/status/123,A saved post,Threads\n" +
      "https://example.com/interesting,Other site,Reading\n" +
      "https://x.com/other/status/456,Another post,Threads\n",
  );
  const incoming = asXImport(parsed);
  assert.equal(incoming.bookmarks.length, 2);
  assert.equal(incoming.lists.length, 1);
  assert.equal(incoming.lists[0].name, "Threads");
  assert.ok(incoming.bookmarks.every((bookmark) => bookmark.source === "x"));
  assert.ok(isXPostUrl("https://mobile.twitter.com/author/status/123"));
  assert.equal(isXPostUrl("https://x.com/author"), false);
  assert.equal(isXPostUrl("https://notx.com/author/status/123"), false);
});

test("reimporting an existing X link preserves personal edits and classifies its source", () => {
  const personal = makeBookmark("https://twitter.com/author/status/123", {
    title: "My preferred title",
    note: "Keep these notes",
    favorite: true,
  });
  const incoming = makeBookmark("https://x.com/author/status/123", {
    title: "Exported title",
    source: "x",
  });
  const result = ingestBookmarks({ bookmarks: [personal], lists: [] }, [incoming], [], {
    autoOrganize: false,
  });
  assert.equal(result.duplicates, 1);
  assert.equal(result.added.length, 0);
  assert.equal(result.library.bookmarks.length, 1);
  assert.equal(result.library.bookmarks[0].source, "x");
  assert.equal(result.library.bookmarks[0].title, "My preferred title");
  assert.equal(result.library.bookmarks[0].note, "Keep these notes");
  assert.equal(result.library.bookmarks[0].favorite, true);
});

test("X provenance survives Nest backups without enabling the X UI on other devices", () => {
  const original = {
    bookmarks: [makeBookmark("https://x.com/author/status/123", { source: "x" })],
    lists: [],
  };
  const backup = createBackup(original, { ...defaultSettings, xImportEnabled: true });
  const restored = parseBackup(JSON.stringify(backup));
  assert.equal(restored.library.bookmarks[0].source, "x");
  assert.equal("xImportEnabled" in (backup.preferences as object), false);
});
