import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractUrls,
  validUrl,
  classify,
  makeBookmark,
  parseImport,
  titleFromUrl,
} from "../src/lib/bookmarks";
import { parsePaste } from "../src/lib/paste";
import { ingestBookmarks } from "../src/lib/organize";

test("extracts bare, international, protocol-relative, and balanced URLs from prose", () => {
  assert.deepEqual(
    extractUrls(
      "Keep FIGMA.com/design, //github.com/nest and www.web.dev/learn?x=1&y=2. Also (en.wikipedia.org/wiki/Bookmark_(digital)). bücher.de and example.com:8080/path",
    ),
    [
      "https://figma.com/design",
      "https://github.com/nest",
      "https://www.web.dev/learn?x=1&y=2",
      "https://en.wikipedia.org/wiki/Bookmark_(digital)",
      "https://xn--bcher-kva.de/",
      "https://example.com:8080/path",
    ],
  );
  assert.deepEqual(
    extractUrls(
      "user@example.com not.a.invalid file.json release.v1.2 javascript:https://evil.com ftp://unsafe.com mailto:me@example.org",
    ),
    [],
  );
  assert.deepEqual(extractUrls("example.com123 not.a.invalid xn--bcher-kva.de example.xn--p1ai"), [
    "https://xn--bcher-kva.de/",
    "https://example.xn--p1ai/",
  ]);
  assert.deepEqual(extractUrls("https://example.com/a;https://example.org/b"), [
    "https://example.com/a",
    "https://example.org/b",
  ]);
  assert.equal(validUrl("HTTPS://EXAMPLE.COM"), "https://example.com/");
  assert.equal(validUrl("https://user:secret@example.com"), null);
  assert.equal(titleFromUrl("https://example.com/bad%xx"), "Bad%xx");
});
test("parses folder instructions before or after links and preserves multiple sections", () => {
  for (const text of [
    'Save figma.com and github.com under "Weekend ideas"',
    "Put these in a folder called Weekend ideas\nfigma.com\ngithub.com",
    "figma.com\ngithub.com\nAdd these to my Weekend ideas folder, create it if it doesn’t exist",
  ]) {
    const entries = parsePaste(text);
    assert.equal(entries.length, 2, text);
    assert.deepEqual(
      entries.map((entry) => entry.folderName),
      ["Weekend ideas", "Weekend ideas"],
      text,
    );
  }
  assert.deepEqual(
    parsePaste("Design:\nfigma.com\n## Code\ngithub.com").map((entry) => entry.folderName),
    ["Design", "Code"],
  );
  assert.equal(parsePaste("github.com\nFolder: Research")[0].folderName, "Research");
  assert.equal(parsePaste('Save figma.com in "Reading"')[0].context, "");
  assert.equal(
    parsePaste("Create a folder called Research and add these links\ngithub.com")[0].folderName,
    "Research",
  );
  assert.equal(parsePaste("A guide to accessible design github.com")[0].folderName, undefined);
});
test("classification weighs known domains and uses word boundaries", () => {
  assert.equal(classify("A heart and a capital city"), "Unsorted");
  assert.equal(
    classify("https://github.com/author/project Design your reading app"),
    "Development",
  );
  assert.equal(classify("Garden planting and growing healthy food"), "Life & living");
  assert.equal(classify("Thoughtful typography and accessible interfaces"), "Design");
});
test("automatic filing reuses topic folders and explicit folders take priority", () => {
  const lists = [{ id: "design", name: "Design things", color: "lilac", updatedAt: 1 }];
  const one = makeBookmark("https://figma.com/one");
  const automatic = ingestBookmarks({ bookmarks: [], lists }, [one], [], { autoOrganize: true });
  assert.deepEqual(automatic.added[0].listIds, ["design"]);
  assert.equal(automatic.library.lists.length, 1);
  const explicit = ingestBookmarks({ bookmarks: [], lists }, [one], [], {
    autoOrganize: true,
    folders: { [one.id]: "Weekend ideas" },
  });
  assert.equal(explicit.library.lists.length, 2);
  assert.equal(explicit.added[0].listIds[0], explicit.library.lists[1].id);
  assert.deepEqual(
    ingestBookmarks({ bookmarks: [], lists }, [one], [], { autoOrganize: false }).added[0].listIds,
    [],
  );
});
test("duplicate links gain requested folders, keeping notes and metadata", () => {
  const old = makeBookmark("https://example.com", { note: "Keep this note", title: "My title" });
  const incoming = makeBookmark("http://www.example.com/?utm_source=paste", {
    title: "Replacement",
  });
  const result = ingestBookmarks({ bookmarks: [old], lists: [] }, [incoming], [], {
    folders: { [incoming.id]: "Research" },
  });
  assert.equal(result.added.length, 0);
  assert.equal(result.duplicates, 1);
  assert.equal(result.filed, 1);
  assert.equal(result.library.bookmarks[0].note, old.note);
  assert.equal(result.library.bookmarks[0].title, old.title);
  assert.deepEqual(result.library.bookmarks[0].listIds, [result.library.lists[0].id]);
  assert.equal(
    ingestBookmarks(
      { bookmarks: [old], lists: [] },
      [makeBookmark(old.url, { topic: "Design" })],
      [],
      { autoOrganize: true },
    ).library.lists.length,
    0,
  );
});
test("imports remap folder IDs by normalized name and merge within-batch destinations", () => {
  const existingList = { id: "existing", name: "Research notes", color: "blue", updatedAt: 1 };
  const importedList = {
    id: "imported",
    name: "  RESEARCH   notes ",
    color: "lilac",
    updatedAt: 2,
  };
  const first = makeBookmark("https://example.com/a", { listIds: ["imported"] });
  const second = makeBookmark(first.url);
  const result = ingestBookmarks(
    { bookmarks: [], lists: [existingList] },
    [first, second],
    [importedList],
    { autoOrganize: true, folders: { [second.id]: "Other ideas" } },
  );
  assert.equal(result.added.length, 1);
  assert.equal(result.library.lists.length, 2);
  assert.deepEqual(result.added[0].listIds, ["existing", result.library.lists[1].id]);
  assert.equal(result.library.lists[0].color, "blue");
});
test("JSON imports normalize bare URLs without raw values overriding normalization", () => {
  const imported = parseImport(
    JSON.stringify({ bookmarks: [{ url: "github.com/example", title: "Example" }], lists: [] }),
    "EXPORT.JSON",
  );
  assert.equal(imported.bookmarks[0].url, "https://github.com/example");
  assert.equal(imported.bookmarks[0].topic, "Development");
});

test("browser import respects the automatic organization setting", () => {
  const json = JSON.stringify({ children: [{ name: "Figma", url: "figma.com" }] });
  assert.equal(
    parseImport(json, "browser.json", { autoOrganize: false }).bookmarks[0].topic,
    "Unsorted",
  );
});

test("import preserves empty custom folders and honors existing names", () => {
  const list = { id: "empty", name: "Someday", color: "green", updatedAt: 1 };
  const result = ingestBookmarks(
    { bookmarks: [], lists: [] },
    [makeBookmark("https://example.com")],
    [list],
  );
  assert.equal(result.library.lists[0].name, "Someday");
});
