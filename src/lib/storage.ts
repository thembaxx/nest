import { openDB } from "idb";
import type { Library } from "./types";
const db = () =>
  openDB("nest-library", 1, {
    upgrade(db) {
      db.createObjectStore("library");
    },
  });
export async function readLibrary(): Promise<Library | undefined> {
  try {
    return await (await db()).get("library", "current");
  } catch {
    try {
      return JSON.parse(localStorage.getItem("nest-fallback") || "null") || undefined;
    } catch {
      return undefined;
    }
  }
}
export async function writeLibrary(library: Library) {
  try {
    await (await db()).put("library", library, "current");
  } catch {
    localStorage.setItem("nest-fallback", JSON.stringify(library));
  }
}
