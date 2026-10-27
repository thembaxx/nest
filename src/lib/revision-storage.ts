import { mergeLibrary } from "./bookmarks";
import { captureRevisions, parseRevisionHistory, REVISION_HISTORY_KEY } from "./revision-history";
import type { Library } from "./types";

/** Recovery history is intentionally device-local, outside cloud sync and backups. */
export function mergeWithHistory(local: Library, incoming: Library): Library {
  const merged = mergeLibrary(local, incoming);
  if (typeof window === "undefined") return merged;
  try {
    const history = parseRevisionHistory(localStorage.getItem(REVISION_HISTORY_KEY));
    const next = captureRevisions(history, local, incoming, merged);
    localStorage.setItem(REVISION_HISTORY_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("nest-revisions-changed"));
  } catch {
    window.dispatchEvent(new Event("nest-revisions-failed"));
  }
  return merged;
}
