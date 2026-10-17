import { openDB } from "idb";
import { librarySchema, type Library } from "./types";
let connection: ReturnType<typeof openDB> | undefined;
const db = () =>
  (connection ??= openDB("nest-library", 1, {
    upgrade(db) {
      db.createObjectStore("library");
    },
  }).catch((error) => {
    connection = undefined;
    throw error;
  }));
export async function readLibrary(): Promise<Library | undefined> {
  // A failed IndexedDB write may leave a newer fallback than the database copy.
  try {
    const fallback = localStorage.getItem("nest-fallback");
    if (fallback) return librarySchema.parse(JSON.parse(fallback));
  } catch {}
  try {
    const stored = await (await db()).get("library", "current");
    return stored ? librarySchema.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}
export async function writeLibrary(library: Library) {
  try {
    await (await db()).put("library", library, "current");
    try {
      localStorage.removeItem("nest-fallback");
    } catch {}
  } catch {
    localStorage.setItem("nest-fallback", JSON.stringify(library));
  }
}
