import { safeFetch } from "@/lib/safe-fetch";
import { rateLimit } from "@/lib/rate-limit";
export const maxDuration = 30;
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
export async function POST(request: Request) {
  if (!rateLimit(request, "meta"))
    return Response.json(
      { error: "Please wait a moment before adding more links." },
      { status: 429 },
    );
  try {
    const { url } = await request.json();
    if (typeof url !== "string" || url.length > 4000)
      return Response.json({ error: "Invalid URL" }, { status: 400 });
    const result = await safeFetch(url);
    const meta = (name: string) => {
      const tags = result.text.match(/<meta\s[^>]*>/gi) || [];
      for (const tag of tags)
        if (new RegExp(`(?:property|name)=["']${name}["']`, "i").test(tag))
          return decode(tag.match(/content=["']([^"']*)["']/i)?.[1] || "");
      return "";
    };
    return Response.json({
      title: (
        meta("og:title") || decode(result.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
      ).slice(0, 500),
      description: (meta("og:description") || meta("description")).slice(0, 2000),
      status: result.status >= 200 && result.status < 400 ? "healthy" : "unchecked",
    });
  } catch {
    return Response.json({ title: "", description: "", status: "unchecked" });
  }
}
