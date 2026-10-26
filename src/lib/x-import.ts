import type { Library } from "./types";

/** Only an explicitly chosen X export can assign X provenance. */
export function isXPostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      /^(?:[a-z0-9-]+\.)*(?:x\.com|twitter\.com)$/i.test(parsed.hostname) &&
      /\/status\/\d+(?:\/|$)/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export function asXImport(parsed: Library): Library {
  const bookmarks = parsed.bookmarks
    .filter((bookmark) => isXPostUrl(bookmark.url))
    .map((bookmark) => ({ ...bookmark, source: "x" as const }));
  const usedLists = new Set(bookmarks.flatMap((bookmark) => bookmark.listIds));
  return {
    bookmarks,
    lists: parsed.lists.filter((list) => usedLists.has(list.id)),
  };
}
