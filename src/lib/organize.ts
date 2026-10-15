import { canonicalUrl, classify } from "./bookmarks";
import { cleanFolderName, folderKey } from "./paste";
import type { Bookmark, BookmarkList, Library, Topic } from "./types";

export type IngestOptions = { autoOrganize?: boolean; folders?: Record<string, string> };
const topicFolders: Partial<Record<Topic, { color: string; names: string[] }>> = {
  Design: { color: "lilac", names: ["Design", "Design things", "Design resources"] },
  Development: { color: "blue", names: ["Development", "A better web", "Code", "Programming"] },
  Reading: { color: "yellow", names: ["Reading", "Reading list", "Books"] },
  Inspiration: { color: "peach", names: ["Inspiration", "Creative inspiration"] },
  "Life & living": { color: "green", names: ["Life & living", "Slow living"] },
};
export function ingestBookmarks(
  library: Library,
  incoming: Bookmark[],
  importedLists: BookmarkList[] = [],
  options: IngestOptions = {},
) {
  const now = Date.now();
  const lists = [...library.lists];
  const byName = new Map(
    lists.filter((list) => !list.deletedAt).map((list) => [folderKey(list.name), list]),
  );
  const byId = new Map(lists.filter((list) => !list.deletedAt).map((list) => [list.id, list]));
  const imported = new Map(
    importedLists.filter((list) => !list.deletedAt).map((list) => [list.id, list]),
  );
  function ensureFolder(name: string, color = "lilac", preferredId?: string) {
    const cleaned = cleanFolderName(name);
    if (!cleaned) return undefined;
    const found = byName.get(folderKey(cleaned));
    if (found) return found.id;
    if (lists.length >= 200)
      throw Error("Your library has reached its 200-folder limit. Reuse an existing folder.");
    const id =
      preferredId && !lists.some((list) => list.id === preferredId)
        ? preferredId
        : crypto.randomUUID();
    const list = { id, name: cleaned, color, updatedAt: now };
    lists.push(list);
    byName.set(folderKey(cleaned), list);
    byId.set(id, list);
    return id;
  }
  for (const list of imported.values()) ensureFolder(list.name, list.color, list.id);
  const records = new Map(library.bookmarks.map((bookmark) => [bookmark.id, bookmark]));
  const keys = new Map(
    library.bookmarks
      .filter((bookmark) => !bookmark.deletedAt)
      .map((bookmark) => [canonicalUrl(bookmark.url), bookmark.id]),
  );
  const addedIds: string[] = [];
  const filedIds = new Set<string>();
  let duplicates = 0;
  for (const source of incoming) {
    const key = canonicalUrl(source.url);
    const existingId = keys.get(key);
    const explicitName = options.folders?.[source.id];
    const destinations: string[] = [];
    if (explicitName) {
      const id = ensureFolder(explicitName);
      if (id) destinations.push(id);
    } else
      for (const sourceId of source.listIds) {
        const importedList = imported.get(sourceId);
        const id = importedList
          ? ensureFolder(importedList.name, importedList.color, importedList.id)
          : byId.get(sourceId)?.id;
        if (id) destinations.push(id);
      }
    if (existingId) {
      duplicates++;
      const old = records.get(existingId)!;
      const listIds = [...new Set([...old.listIds, ...destinations])];
      if (listIds.length !== old.listIds.length) {
        if (listIds.length > 50) throw Error("A bookmark can belong to up to 50 folders.");
        records.set(existingId, { ...old, listIds, updatedAt: now });
        filedIds.add(existingId);
      }
      continue;
    }
    const bookmark = { ...source, listIds: [...new Set(destinations)] };
    if (options.autoOrganize && bookmark.topic === "Unsorted")
      bookmark.topic = classify(
        [bookmark.url, bookmark.title, bookmark.description, ...bookmark.tags].join(" "),
      );
    if (
      options.autoOrganize &&
      !bookmark.listIds.length &&
      !explicitName &&
      !source.listIds.length
    ) {
      const config = topicFolders[bookmark.topic];
      if (config) {
        const existing = config.names.map((name) => byName.get(folderKey(name))).find(Boolean);
        const id = existing?.id || ensureFolder(bookmark.topic, config.color);
        if (id) bookmark.listIds = [id];
      }
    }
    // A restored import can reuse an ID already present locally; never overwrite that record.
    if (records.has(bookmark.id)) bookmark.id = crypto.randomUUID();
    records.set(bookmark.id, bookmark);
    keys.set(key, bookmark.id);
    addedIds.push(bookmark.id);
  }
  if (records.size > 10000)
    throw Error(
      "Your library has reached its 10,000-bookmark limit. Export a backup to keep a copy.",
    );
  const added = addedIds.map((id) => records.get(id)!);
  const result: Library = {
    bookmarks: [...added, ...library.bookmarks.map((bookmark) => records.get(bookmark.id)!)],
    lists,
  };
  return { library: result, added, duplicates, filed: filedIds.size };
}
