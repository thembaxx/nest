import { z } from "zod";
import { librarySchema, type Library, type Settings } from "./types";
import { prepareSyncLibrary } from "./sync";
import { decryptData, encryptData, MAX_BACKUP_BYTES, passwordKey } from "./encryption";

const preferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  autoSort: z.boolean(),
  healthChecks: z.boolean(),
  effects: z.boolean(),
});
const backupSchema = z.object({
  format: z.literal("nest-backup"),
  version: z.literal(1),
  createdAt: z.iso.datetime(),
  library: librarySchema,
  preferences: preferencesSchema,
});
export type Backup = { library: Library; preferences?: z.infer<typeof preferencesSchema> };

export function personalLibrary(library: Library): Library {
  const prepared = prepareSyncLibrary(library);
  return librarySchema.parse({
    bookmarks: prepared.bookmarks.filter((bookmark) => !bookmark.demo),
    lists: prepared.lists.filter((list) => list.updatedAt !== 0),
  });
}
export function createBackup(library: Library, settings: Settings) {
  return backupSchema.parse({
    format: "nest-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    library: personalLibrary(library),
    // Device credentials, downloaded models, and sign-in sessions never travel in a backup.
    preferences: preferencesSchema.parse(settings),
  });
}
export async function encryptedBackup(library: Library, settings: Settings, password: string) {
  const { key, salt } = await passwordKey(password);
  return {
    ...(await encryptData(createBackup(library, settings), key, "backup")),
    kdf: { name: "PBKDF2-SHA256", iterations: 600000, salt },
  };
}
export async function readBackup(text: string, password: string): Promise<Backup> {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw Error("Choose a backup smaller than 20 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
    if (raw && typeof raw === "object" && "format" in raw && raw.format === "nest-encrypted") {
      const { kdf } = z
        .object({
          kdf: z.object({
            name: z.literal("PBKDF2-SHA256"),
            iterations: z.literal(600000),
            salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
          }),
        })
        .parse(raw);
      const { key } = await passwordKey(password, kdf.salt);
      raw = await decryptData(raw, key, "backup");
    }
    if (raw && typeof raw === "object" && "format" in raw) {
      const backup = backupSchema.parse(raw);
      return { library: personalLibrary(backup.library), preferences: backup.preferences };
    }
    // Restore older Nest JSON exports without regenerating IDs or losing notes.
    return { library: personalLibrary(librarySchema.parse(raw)) };
  } catch {
    throw Error("Could not open this backup. Check the file and, if encrypted, its password.");
  }
}
