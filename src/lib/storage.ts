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
  let fallback: string | null = null;
  try {
    fallback = localStorage.getItem("nest-fallback");
  } catch {}
  if (fallback) {
    try {
      return librarySchema.parse(JSON.parse(fallback));
    } catch {
      throw Error("Your saved library could not be read. Its stored copy has been kept.");
    }
  }
  try {
    const stored = await (await db()).get("library", "current");
    return stored === undefined ? undefined : librarySchema.parse(stored);
  } catch {
    throw Error("Your saved library could not be opened. Its stored copy has been kept.");
  }
}
let pendingWrite = Promise.resolve();
export function writeLibrary(library: Library): Promise<void> {
  // Serialize writes so a delayed fallback cannot replace a more recent edit.
  const writing = pendingWrite.then(() => persist(library));
  pendingWrite = writing.catch(() => {});
  return writing;
}
async function persist(library: Library) {
  try {
    await (await db()).put("library", library, "current");
  } catch {
    localStorage.setItem("nest-fallback", JSON.stringify(library));
    return;
  }
  // Never leave an older fallback taking precedence over a successful IDB write.
  try {
    localStorage.removeItem("nest-fallback");
  } catch {
    localStorage.setItem("nest-fallback", JSON.stringify(library));
  }
}
export async function downloadStorageRecovery() {
  const copies: Record<string, unknown> = {};
  try {
    const fallback = localStorage.getItem("nest-fallback");
    if (fallback) copies.fallback = fallback;
  } catch {}
  try {
    const stored = await (await db()).get("library", "current");
    if (stored) copies.indexedDB = stored;
  } catch {}
  if (!Object.keys(copies).length)
    throw Error("Browser storage is unavailable. Allow site storage and try opening Nest again.");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ format: "nest-storage-recovery", copies })], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nest-storage-recovery.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
