import { z } from "zod";
import { librarySchema, type Library, type Settings } from "./types";
import { prepareSyncLibrary } from "./sync";
import { mergeWithHistory as mergeLibrary } from "./revision-storage";
import { decryptData, encryptData, MAX_BACKUP_BYTES, passwordKey } from "./encryption";

const preferencesSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]),
    autoSort: z.boolean(),
    healthChecks: z.boolean(),
    effects: z.boolean(),
  })
  .partial();
const backupSchema = z.object({
  format: z.literal("nest-backup"),
  version: z.literal(1),
  createdAt: z.iso.datetime(),
  library: librarySchema,
  preferences: preferencesSchema,
});
export type Backup = { library: Library; preferences?: z.infer<typeof preferencesSchema> };

const flatBackupSchema = librarySchema.extend({
  format: z.literal("nest-backup"),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  preferences: preferencesSchema.optional(),
});

function validateIds(library: Library) {
  for (const records of [library.bookmarks, library.lists])
    if (new Set(records.map((record) => record.id)).size !== records.length)
      throw Error("This backup contains duplicate record IDs.");
}

function parseData(raw: unknown): Backup {
  if (raw && typeof raw === "object" && "format" in raw) {
    if (raw.format !== "nest-backup" || !("version" in raw) || raw.version !== 1)
      throw Error("This backup format is not supported.");
    // The earlier release used top-level records and exportedAt rather than a library object.
    const backup = "library" in raw ? backupSchema.parse(raw) : flatBackupSchema.parse(raw);
    const library = "library" in backup ? backup.library : backup;
    validateIds(library);
    return { library: personalLibrary(library), preferences: backup.preferences };
  }
  const library = librarySchema.parse(raw);
  validateIds(library);
  return { library: personalLibrary(library) };
}

export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw Error("Choose a backup smaller than 20 MB.");
  return parseData(JSON.parse(text));
}

export function restoreLibrary(local: Library, incoming: Library): Library {
  return librarySchema.parse(mergeLibrary(prepareSyncLibrary(local), incoming));
}

export function personalLibrary(library: Library): Library {
  const prepared = prepareSyncLibrary(library);
  const personal = librarySchema.parse({
    bookmarks: prepared.bookmarks.filter((bookmark) => !bookmark.demo),
    lists: prepared.lists.filter((list) => list.updatedAt !== 0),
  });
  validateIds(personal);
  return personal;
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
    return parseData(raw);
  } catch {
    throw Error("Could not open this backup. Check the file and, if encrypted, its password.");
  }
}
