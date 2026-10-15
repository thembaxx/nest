import { parse } from "tldts";

export function validUrl(value: string): string | null {
  if (typeof value !== "string" || value.length > 4000 || /\s/.test(value)) return null;
  const raw = value.trim();
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw) && !/^[^/]+:\d+(?:[/?#]|$)/.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(hasScheme ? raw : raw.startsWith("//") ? `https:${raw}` : `https://${raw}`);
    if (
      !/^https?:$/.test(url.protocol) ||
      !url.hostname.includes(".") ||
      url.username ||
      url.password
    )
      return null;
    const domain = parse(url.hostname, { allowPrivateDomains: true });
    if (!hasScheme && (!domain.domain || (!domain.isIcann && !domain.isPrivate))) return null;
    return url.href;
  } catch {
    return null;
  }
}

function trimPunctuation(value: string) {
  let result = value.replace(/[.,;!?:]+$/, "");
  for (const [open, close] of [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ]) {
    while (result.endsWith(close) && result.split(close).length > result.split(open).length)
      result = result.slice(0, -1);
  }
  return result.replace(/[.,;!?:]+$/, "");
}

export type FoundLink = { url: string; start: number; end: number };
export function findLinks(text: string): FoundLink[] {
  const label = String.raw`[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?`;
  const domain = String.raw`(?:${label}\.)+(?:xn--[a-z\d-]+|[\p{L}]{2,})(?![\p{L}\p{N}_-]|\.[\p{L}\p{N}])`;
  const pattern = new RegExp(
    String.raw`(?<![\p{L}\p{N}_@./:-])(?:[a-z][a-z\d+.-]*:[^\s<>"'\x60]+|(?:\/\/)?${domain}(?::\d{1,5})?(?:[/?#][^\s<>"'\x60]*)?)`,
    "giu",
  );
  const links: FoundLink[] = [];
  for (const match of text.matchAll(pattern)) {
    // A comma separating two domains is prose; commas inside a URL path remain valid.
    const pieces = match[0].split(
      /[,;](?=(?:https?:\/\/|www\.|[\p{L}\p{N}-]+\.[\p{L}]{2,}(?:[/?#]|$)))/iu,
    );
    let offset = 0;
    for (const piece of pieces) {
      const clean = trimPunctuation(piece);
      const url = validUrl(clean);
      if (url)
        links.push({ url, start: match.index + offset, end: match.index + offset + clean.length });
      offset += piece.length + 1;
    }
  }
  return links;
}
export function extractUrls(text: string): string[] {
  return [...new Set(findLinks(text).map((link) => link.url))];
}
