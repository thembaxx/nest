import type { BookmarkList, Library } from "./types";
import { cleanFolderName, folderKey } from "./paste";
export function updateCollection(
  library: Library,
  id: string,
  changes: Pick<BookmarkList, "name" | "color">,
): Library {
  const name = cleanFolderName(changes.name);
  if (!name) throw Error("Give your collection a name.");
  if (
    library.lists.some(
      (list) => list.id !== id && !list.deletedAt && folderKey(list.name) === folderKey(name),
    )
  )
    throw Error("A collection with that name already exists.");
  return {
    ...library,
    lists: library.lists.map((list) =>
      list.id === id && !list.deletedAt
        ? {
            ...list,
            name,
            color: changes.color,
            updatedAt: Math.max(Date.now(), list.updatedAt + 1),
          }
        : list,
    ),
  };
}
export function removeCollection(library: Library, id: string): Library {
  const now = Date.now();
  return {
    lists: library.lists.map((list) =>
      list.id === id
        ? { ...list, deletedAt: now, updatedAt: Math.max(now, list.updatedAt + 1) }
        : list,
    ),
    bookmarks: library.bookmarks.map((bookmark) =>
      bookmark.listIds.includes(id)
        ? {
            ...bookmark,
            listIds: bookmark.listIds.filter((listId) => listId !== id),
            updatedAt: Math.max(now, bookmark.updatedAt + 1),
          }
        : bookmark,
    ),
  };
}
export function downloadLibrary(library: Library, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
