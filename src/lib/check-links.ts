import type { Bookmark } from "./types";
import { safeFetch } from "./safe-fetch";
export async function checkLink(b: Bookmark): Promise<Bookmark> {
  const now = Date.now();
  try {
    let r = await safeFetch(b.url, "HEAD");
    if (r.status === 405 || r.status === 501) r = await safeFetch(b.url, "GET", 1024);
    const healthy = r.status >= 200 && r.status < 400;
    const missing = r.status === 404 || r.status === 410;
    const failures = missing ? b.failures + 1 : healthy ? 0 : b.failures;
    return {
      ...b,
      status: healthy ? "healthy" : missing && failures >= 2 ? "dead" : "unreachable",
      failures,
      lastChecked: now,
      updatedAt: now,
    };
  } catch {
    return { ...b, status: "unreachable", lastChecked: now, updatedAt: now };
  }
}
