const limits = new Map<string, { count: number; reset: number }>();
export function rateLimit(request: Request, scope: string, max = 40) {
  const now = Date.now();
  if (limits.size > 10000)
    for (const [key, value] of limits) if (value.reset < now) limits.delete(key);
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "local";
  const key = scope + ip;
  let entry = limits.get(key);
  if (!entry || entry.reset < now) {
    entry = { count: 0, reset: now + 60000 };
    limits.set(key, entry);
  }
  return ++entry.count <= max;
}
