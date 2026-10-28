import { seed } from "./seed";
import type { Library } from "./types";
// Untouched sample folders must not overwrite a real collection on another device.
export function prepareSyncLibrary(library: Library): Library {
  return {
    ...library,
    lists: library.lists.map((list) => {
      const sample = seed.lists.find((item) => item.id === list.id);
      const untouched =
        sample &&
        !list.deletedAt &&
        list.name === sample.name &&
        list.color === sample.color &&
        !library.bookmarks.some((bookmark) => !bookmark.demo && bookmark.listIds.includes(list.id));
      if (untouched) return { ...list, updatedAt: 0 };
      // Reusing a seed folder does not itself edit the folder record. Give it a
      // stable personal timestamp so backups and sync retain its memberships.
      if (sample && list.updatedAt === 0)
        return {
          ...list,
          updatedAt: library.bookmarks.reduce(
            (latest, bookmark) =>
              !bookmark.demo && bookmark.listIds.includes(list.id)
                ? Math.max(latest, bookmark.updatedAt)
                : latest,
            1,
          ),
        };
      return list;
    }),
  };
}
