import { z } from "zod";
import {
  bookmarkSchema,
  librarySchema,
  listSchema,
  type Bookmark,
  type BookmarkList,
  type Library,
} from "./types";

export const REVISION_HISTORY_KEY = "nest-revision-history-v1";
export const MAX_REVISIONS = 100;
export const MAX_HISTORY_BYTES = 1_000_000;

const revisionSchema = z.discriminatedUnion("kind", [
  z.object({
    version: z.literal(1),
    kind: z.literal("bookmark"),
    capturedAt: z.number().finite().nonnegative(),
    record: bookmarkSchema,
  }),
  z.object({
    version: z.literal(1),
    kind: z.literal("collection"),
    capturedAt: z.number().finite().nonnegative(),
    record: listSchema,
  }),
]);

export type Revision = z.infer<typeof revisionSchema> & { id: string };
type RecordValue = Bookmark | BookmarkList;

function canonical(record: RecordValue): string {
  return JSON.stringify(record, Object.keys(record).sort());
}

function identity(kind: Revision["kind"], record: RecordValue): string {
  return `${kind}:${canonical(record)}`;
}

function revisionId(kind: Revision["kind"], record: RecordValue): string {
  const value = identity(kind, record);
  // The complete canonical record is used for deduplication, so hash collisions
  // cannot discard revisions. The compact ID is only a UI selection key.
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < value.length; index++) {
    first = Math.imul(first ^ value.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ value.charCodeAt(index);
  }
  return `${kind}:${encodeURIComponent(record.id)}:${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

function bounded(entries: Revision[]): Revision[] {
  const unique = new Map<string, Revision>();
  for (const entry of entries) {
    const key = identity(entry.kind, entry.record);
    const previous = unique.get(key);
    if (!previous || entry.capturedAt < previous.capturedAt) unique.set(key, entry);
  }
  const sorted = [...unique.values()].sort(
    (a, b) => b.capturedAt - a.capturedAt || a.id.localeCompare(b.id),
  );
  const result: Revision[] = [];
  let bytes = 2;
  const encoder = new TextEncoder();
  for (const entry of sorted) {
    const size = encoder.encode(JSON.stringify(entry)).byteLength + 1;
    if (bytes + size > MAX_HISTORY_BYTES) continue;
    result.push(entry);
    bytes += size;
    if (result.length === MAX_REVISIONS) break;
  }
  return result;
}

/** Malformed entries are ignored. Unknown fields (including settings) are stripped. */
export function parseRevisionHistory(raw: unknown): Revision[] {
  if (typeof raw === "string") {
    if (new TextEncoder().encode(raw).byteLength > MAX_HISTORY_BYTES) return [];
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw) || raw.length > 10_000) return [];
  const entries: Revision[] = [];
  for (const candidate of raw) {
    const parsed = revisionSchema.safeParse(candidate);
    if (!parsed.success || (parsed.data.kind === "bookmark" && parsed.data.record.demo)) continue;
    entries.push({
      ...parsed.data,
      id: revisionId(parsed.data.kind, parsed.data.record),
    });
  }
  return bounded(entries);
}

function sameContent(a: RecordValue, b: RecordValue): boolean {
  const { updatedAt: _a, ...one } = a;
  const { updatedAt: _b, ...two } = b;
  return (
    JSON.stringify(one, Object.keys(one).sort()) === JSON.stringify(two, Object.keys(two).sort())
  );
}

/**
 * Record losing values around any merge, using its actual result as the winner.
 * This captures edits, collection changes and tombstones without altering merge
 * precedence or writing anything to storage. History stays on the current device.
 */
export function captureRevisions(
  history: readonly Revision[],
  local: Library,
  incoming: Library,
  merged: Library,
  now = Date.now(),
): Revision[] {
  if (!Number.isFinite(now) || now < 0) throw new Error("Invalid revision time.");
  const one = librarySchema.parse(local);
  const two = librarySchema.parse(incoming);
  const result = librarySchema.parse(merged);
  const entries = parseRevisionHistory(history);
  for (const kind of ["bookmark", "collection"] as const) {
    const field = kind === "bookmark" ? "bookmarks" : "lists";
    const left = new Map<string, RecordValue>(one[field].map((record) => [record.id, record]));
    const right = new Map<string, RecordValue>(two[field].map((record) => [record.id, record]));
    for (const winner of result[field]) {
      const a = left.get(winner.id);
      const b = right.get(winner.id);
      if (!a || !b || sameContent(a, b)) continue;
      for (const record of [a, b]) {
        if (sameContent(record, winner) || ("demo" in record && record.demo)) continue;
        const parsed = revisionSchema.parse({ version: 1, kind, capturedAt: now, record });
        entries.push({ ...parsed, id: revisionId(kind, parsed.record) });
      }
    }
  }
  return bounded(entries);
}

export interface RevisionPreview {
  kind: Revision["kind"];
  recordId: string;
  label: string;
  saved: RecordValue;
  current: RecordValue | null;
  changedFields: string[];
  willDelete: boolean;
}

function validatedRevision(revision: Revision): Revision {
  const parsed = parseRevisionHistory([revision])[0];
  if (!parsed) throw new Error("This revision is invalid or unavailable.");
  return parsed;
}

/** Preview does not mutate the library or mark a revision restored. */
export function previewRevision(revision: Revision, library: Library): RevisionPreview {
  const entry = validatedRevision(revision);
  const parsed = librarySchema.parse(library);
  const field = entry.kind === "bookmark" ? "bookmarks" : "lists";
  const current = parsed[field].find((record) => record.id === entry.record.id) ?? null;
  const saved = entry.record;
  const keys = new Set([...Object.keys(saved), ...Object.keys(current ?? {})]);
  const changedFields = [...keys].filter(
    (key) =>
      key !== "updatedAt" &&
      JSON.stringify((saved as Record<string, unknown>)[key]) !==
        JSON.stringify((current as Record<string, unknown> | null)?.[key]),
  );
  return {
    kind: entry.kind,
    recordId: saved.id,
    label: "title" in saved ? saved.title : saved.name,
    saved: structuredClone(saved),
    current: current ? structuredClone(current) : null,
    changedFields: changedFields.sort(),
    willDelete: saved.deletedAt !== undefined,
  };
}

/** Restore the saved value as a fresh edit, preserving its record ID. */
export function restoreRevision(library: Library, revision: Revision, now = Date.now()): Library {
  if (!Number.isFinite(now) || now < 0) throw new Error("Invalid restore time.");
  const entry = validatedRevision(revision);
  const parsed = librarySchema.parse(library);
  const field = entry.kind === "bookmark" ? "bookmarks" : "lists";
  const current = parsed[field].find((record) => record.id === entry.record.id);
  const updatedAt = Math.max(now, (current?.updatedAt ?? 0) + 1, entry.record.updatedAt + 1);
  if (!Number.isSafeInteger(updatedAt))
    throw new Error("The revision timestamp cannot be restored safely.");
  const restored = { ...entry.record, updatedAt };
  if (entry.kind === "bookmark") {
    parsed.bookmarks = [
      ...parsed.bookmarks.filter((record) => record.id !== restored.id),
      bookmarkSchema.parse(restored),
    ];
  } else {
    parsed.lists = [
      ...parsed.lists.filter((record) => record.id !== restored.id),
      listSchema.parse(restored),
    ];
  }
  return librarySchema.parse(parsed);
}
