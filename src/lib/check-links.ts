import type { Bookmark } from "./types";
import { safeFetch } from "./safe-fetch";

export function applyLinkCheck(
  bookmark: Bookmark,
  httpStatus?: number,
  now = Date.now(),
): Bookmark {
  const healthy = httpStatus !== undefined && httpStatus >= 200 && httpStatus < 400;
  const missing = httpStatus === 404 || httpStatus === 410;
  const failures = healthy ? 0 : missing ? bookmark.failures + 1 : bookmark.failures;
  // Ambiguous failures cannot undo an already confirmed missing page.
  const status = healthy
    ? "healthy"
    : (missing && failures >= 2) || bookmark.status === "dead"
      ? "dead"
      : "unreachable";
  return { ...bookmark, status, failures, lastChecked: now, updatedAt: now };
}

export async function checkLink(bookmark: Bookmark): Promise<Bookmark> {
  try {
    let response = await safeFetch(bookmark.url, "HEAD");
    if (response.status === 405 || response.status === 501)
      response = await safeFetch(bookmark.url, "GET", 1024);
    return applyLinkCheck(bookmark, response.status);
  } catch {
    return applyLinkCheck(bookmark);
  }
}
