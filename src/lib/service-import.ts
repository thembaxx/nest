import { makeBookmark } from "./bookmarks";
import { validUrl } from "./urls";
import type { Library, BookmarkList, Bookmark } from "./types";

type ExternalItem = Record<string, unknown>;
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function convert(items: ExternalItem[], folders: Map<string, string> = new Map()): Library {
  const lists: BookmarkList[] = [];
  const bookmarks: Bookmark[] = [];
  function list(name: string): string[] {
    if (!name.trim()) return [];
    const clean = name.trim().slice(0, 80);
    let id = folders.get(clean.toLowerCase());
    if (!id) {
      id = crypto.randomUUID();
      folders.set(clean.toLowerCase(), id);
      lists.push({ id, name: clean, color: "lilac", updatedAt: Date.now() });
    }
    return [id];
  }
  for (const item of items) {
    const url = validUrl(text(item.link || item.url || item.uri));
    if (!url) continue;
    const tags = Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 30)
      : [];
    const folder = text(item.collection || item.folder || item.category);
    const date = Date.parse(text(item.created || item.created_at || item.createdAt));
    bookmarks.push(
      makeBookmark(url, {
        ...(text(item.title || item.name)
          ? { title: text(item.title || item.name).slice(0, 500) }
          : {}),
        description: text(item.excerpt || item.description).slice(0, 2000),
        tags,
        listIds: list(folder),
        ...(Number.isFinite(date) ? { createdAt: date } : {}),
      }),
    );
  }
  return { bookmarks, lists };
}

export function parseServiceImport(raw: unknown): Library | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  // Raindrop API and JSON exports: items with link and optional collection title.
  if (
    Array.isArray(data.items) &&
    data.items.some((item) => item && typeof item === "object" && "link" in item)
  )
    return convert(data.items as ExternalItem[]);
  // Linkwarden exported links may be nested in collections.
  if (Array.isArray(data.collections)) {
    const items: ExternalItem[] = [];
    for (const collection of data.collections) {
      if (!collection || typeof collection !== "object") continue;
      const group = collection as Record<string, unknown>;
      for (const link of Array.isArray(group.links) ? group.links : []) {
        if (link && typeof link === "object")
          items.push({ ...(link as object), collection: text(group.name) });
      }
    }
    if (items.length) return convert(items);
  }
  return null;
}

export function parseRaindropItems(items: unknown[], collections: Map<number, string>): Library {
  return convert(
    items
      .filter((item): item is ExternalItem => !!item && typeof item === "object")
      .map((item) => ({
        ...item,
        collection:
          collections.get(Number((item.collection as { $id?: number } | undefined)?.$id)) || "",
      })),
  );
}
