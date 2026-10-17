import { z } from "zod";
import { librarySchema, type Library, type Settings } from "./types";
import { mergeLibrary } from "./bookmarks";
import { prepareSyncLibrary } from "./sync";

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const preferencesSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]),
    autoSort: z.boolean(),
    healthChecks: z.boolean(),
    effects: z.boolean(),
  })
  .partial();
const backupSchema = librarySchema.extend({
  format: z.literal("nest-backup"),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  preferences: preferencesSchema.optional(),
});
export type Backup = {
  library: Library;
  preferences?: z.infer<typeof preferencesSchema>;
  exportedAt?: string;
};

export function syncableLibrary(library: Library): Library {
  const prepared = prepareSyncLibrary(library);
  return librarySchema.parse({
    bookmarks: prepared.bookmarks.filter((bookmark) => !bookmark.demo),
    lists: prepared.lists,
  });
}

export function createBackup(library: Library, settings?: Settings): string {
  const data = {
    format: "nest-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    ...syncableLibrary(library),
    ...(settings ? { preferences: preferencesSchema.parse(settings) } : {}),
  };
  const text = JSON.stringify(data, null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw Error("This backup exceeds the 20 MB limit. Export smaller collections separately.");
  return text;
}

export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw Error("Please choose a Nest backup smaller than 20 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw Error("This file is not valid JSON. Choose a Nest JSON backup.");
  }
  if (raw && typeof raw === "object" && "format" in raw) {
    if (raw.format !== "nest-backup" || !("version" in raw) || raw.version !== 1)
      throw Error("This backup format is not supported. Update Nest before restoring it.");
    const parsed = backupSchema.safeParse(raw);
    if (!parsed.success) throw Error("This Nest backup contains invalid or incomplete data.");
    validateIds(parsed.data);
    return {
      library: syncableLibrary(parsed.data),
      preferences: parsed.data.preferences,
      exportedAt: parsed.data.exportedAt,
    };
  }
  // Older Nest exports were unversioned library objects.
  const parsed = librarySchema.safeParse(raw);
  if (!parsed.success) throw Error("Choose a Nest JSON backup. Browser exports belong in Import.");
  validateIds(parsed.data);
  return { library: syncableLibrary(parsed.data) };
}

function validateIds(library: Library) {
  for (const records of [library.bookmarks, library.lists])
    if (new Set(records.map((record) => record.id)).size !== records.length)
      throw Error("This backup contains duplicate record IDs and cannot be restored safely.");
}

export function restoreLibrary(local: Library, backup: Library): Library {
  return librarySchema.parse(mergeLibrary(prepareSyncLibrary(local), backup));
}
