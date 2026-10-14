import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalUrl,
  extractUrls,
  deduplicate,
  makeBookmark,
  mergeLibrary,
  searchScore,
  exportHtml,
} from "../src/lib/bookmarks";
import { publicIp, safeFetch } from "../src/lib/safe-fetch";
import { librarySchema } from "../src/lib/types";
test("extracts multiple links from prose and ignores unsafe protocols", () => {
  assert.deepEqual(
    extractUrls(
      "Try https://example.com/a, and https://other.org/b. Also www.nest.app! javascript:alert(1)",
    ),
    ["https://example.com/a", "https://other.org/b", "https://www.nest.app/"],
  );
});
test("canonical duplicate keys ignore tracking, order, and www but preserve meaningful fragments", () => {
  assert.equal(
    canonicalUrl("http://www.example.com/path/?utm_source=test&b=2&a=1"),
    canonicalUrl("https://example.com/path?a=1&b=2"),
  );
  assert.notEqual(
    canonicalUrl("https://example.com/#one"),
    canonicalUrl("https://example.com/#two"),
  );
});
test("deduplication handles existing and within-batch duplicates but permits re-adding deleted links", () => {
  const old = makeBookmark("https://example.com/");
  const one = makeBookmark("https://foo.org/");
  const result = deduplicate(
    [
      makeBookmark("https://www.example.com/?utm_medium=test"),
      one,
      makeBookmark("https://foo.org"),
    ],
    [old],
  );
  assert.equal(result.duplicates, 2);
  assert.equal(result.added.length, 1);
  assert.equal(
    deduplicate([makeBookmark(old.url)], [{ ...old, deletedAt: Date.now() }]).added.length,
    1,
  );
});
test("sync merging keeps newer records and deletion tombstones", () => {
  const b = makeBookmark("https://example.com", { updatedAt: 10 });
  const local = { bookmarks: [b], lists: [] };
  const removed = { ...b, updatedAt: 20, deletedAt: 20 };
  assert.equal(mergeLibrary(local, { bookmarks: [removed], lists: [] }).bookmarks[0].deletedAt, 20);
  assert.equal(mergeLibrary({ bookmarks: [removed], lists: [] }, local).bookmarks[0].deletedAt, 20);
});
test("topic and synonym search understands a basic natural-language request", () => {
  const b = makeBookmark("https://fonts.google.com", {
    title: "Find your type",
    topic: "Design",
    tags: ["typography"],
  });
  assert.ok(searchScore(b, "find my fonts") > 0);
  assert.equal(searchScore(b, "gardening"), 0);
});
test("exports safe browser HTML without samples or removed bookmarks", () => {
  const b = makeBookmark("https://example.com/?a=1&b=2", { title: 'A <script> & "title"' });
  const html = exportHtml({
    bookmarks: [b, { ...b, id: "demo", demo: true }, { ...b, id: "gone", deletedAt: 1 }],
    lists: [],
  });
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal((html.match(/<DT>/g) || []).length, 1);
  assert.ok(html.includes("&amp;b=2"));
});
test("validates imports and API records before use", () => {
  const b = makeBookmark("https://example.com");
  assert.ok(librarySchema.safeParse({ bookmarks: [b], lists: [] }).success);
  assert.equal(
    librarySchema.safeParse({ bookmarks: [{ ...b, url: "javascript:alert(1)" }], lists: [] })
      .success,
    false,
  );
});
test("metadata fetching rejects private, link-local, mapped, and loopback addresses", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
  ])
    assert.equal(publicIp(ip), false, ip);
  assert.equal(publicIp("1.1.1.1"), true);
  assert.equal(publicIp("2606:4700:4700::1111"), true);
  await assert.rejects(() => safeFetch("http://127.0.0.1/"));
  await assert.rejects(() => safeFetch("file:///etc/passwd"));
});
