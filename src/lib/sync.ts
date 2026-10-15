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
      return untouched ? { ...list, updatedAt: 0 } : list;
    }),
  };
}
