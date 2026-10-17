import { librarySchema, type Bookmark, type BookmarkList, type Library, type Topic } from "./types";
import { validUrl } from "./urls";
import { folderKey } from "./paste";
export { validUrl, extractUrls } from "./urls";
export function canonicalUrl(value: string): string {
  const u = new URL(value);
  u.hash = u.hash === "#" ? "" : u.hash;
  u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
  u.protocol = "https:";
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  return u.href;
}
const rules: Record<Exclude<Topic, "Unsorted">, RegExp> = {
  Design:
    /\b(?:design(?:s|ing)?|figma|typograph\w*|fonts?|colou?rs?|ux|ui|dribbble|interfaces?|awwwards|branding)\b/gi,
  Development:
    /\b(?:github|code|coding|developers?|development|javascript|typescript|react|nextjs|next\.js|vercel|web\.dev|css|programming|three\.js|tailwind|api|engineering|webgl|software)\b/gi,
  Reading:
    /\b(?:books?|essays?|reading|articles?|substack|medium|literature|journals?|newsletters?|writing|poetry)\b/gi,
  Inspiration:
    /\b(?:inspiration|pinterest|are\.na|art|creative|creativity|photograph\w*|museums?|architecture|unsplash|illustration)\b/gi,
  "Life & living":
    /\b(?:travel\w*|recipes?|cook\w*|food|garden\w*|nature|wellness|health|living|hik(?:e|ing)|plants?)\b/gi,
};
const domains: [RegExp, Exclude<Topic, "Unsorted">][] = [
  [/(?:^|\.)(?:figma\.com|dribbble\.com|awwwards\.com|fonts\.google\.com)$/, "Design"],
  [
    /(?:^|\.)(?:github\.com|githubusercontent\.com|developer\.mozilla\.org|web\.dev|vercel\.com|react\.dev|nextjs\.org|stackoverflow\.com)$/,
    "Development",
  ],
  [/(?:^|\.)(?:substack\.com|medium\.com|theparisreview\.org|goodreads\.com)$/, "Reading"],
  [/(?:^|\.)(?:are\.na|pinterest\.com|unsplash\.com|itsnicethat\.com)$/, "Inspiration"],
  [/(?:^|\.)(?:gardenersworld\.com|allrecipes\.com|bbcgoodfood\.com)$/, "Life & living"],
];
export function classify(text: string): Topic {
  const scores = new Map<Topic, number>();
  for (const [topic, rule] of Object.entries(rules))
    scores.set(topic as Topic, (text.match(rule) || []).length);
  for (const link of text.match(/https?:\/\/[^\s]+/gi) || []) {
    try {
      const host = new URL(link).hostname;
      for (const [rule, topic] of domains)
        if (rule.test(host)) scores.set(topic, (scores.get(topic) || 0) + 6);
    } catch {}
  }
  const best = [...scores].sort((a, b) => b[1] - a[1])[0];
  return best?.[1] ? best[0] : "Unsorted";
}
export function titleFromUrl(url: string) {
  const u = new URL(url);
  let slug = u.pathname.split("/").filter(Boolean).pop();
  if (slug) {
    try {
      slug = decodeURIComponent(slug);
    } catch {}
  }
  return slug
    ? slug
        .replace(/[-_]/g, " ")
        .replace(/\.[a-z]+$/i, "")
        .replace(/^./, (v) => v.toUpperCase())
    : u.hostname.replace(/^www\./, "");
}
export function makeBookmark(url: string, meta: Partial<Bookmark> = {}): Bookmark {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    url,
    title: titleFromUrl(url),
    description: "",
    topic: classify(
      [url, meta.title, meta.description, meta.tags?.join(" ")].filter(Boolean).join(" "),
    ),
    tags: [],
    listIds: [],
    favorite: false,
    archived: false,
    read: false,
    status: "unchecked",
    failures: 0,
    createdAt: now,
    updatedAt: now,
    ...meta,
  };
}
export function mergeLibrary(a: Library, b: Library): Library {
  function merge<T extends { id: string; updatedAt: number }>(one: T[], two: T[]) {
    const map = new Map(one.map((x) => [x.id, x]));
    for (const item of two) {
      const old = map.get(item.id);
      if (!old || item.updatedAt >= old.updatedAt) map.set(item.id, item);
    }
    return [...map.values()];
  }
  const personalIds = new Set(
    [...a.bookmarks, ...b.bookmarks]
      .filter((bookmark) => !bookmark.demo)
      .map((bookmark) => bookmark.id),
  );
  const personalWins = (bookmark: Bookmark) => !bookmark.demo || !personalIds.has(bookmark.id);
  return {
    bookmarks: merge(a.bookmarks.filter(personalWins), b.bookmarks.filter(personalWins)),
    lists: merge(a.lists, b.lists),
  };
}
export function deduplicate(incoming: Bookmark[], existing: Bookmark[]) {
  const keys = new Set(existing.filter((b) => !b.deletedAt).map((b) => canonicalUrl(b.url)));
  let duplicates = 0;
  const added = incoming.filter((b) => {
    const key = canonicalUrl(b.url);
    if (keys.has(key)) {
      duplicates++;
      return false;
    }
    keys.add(key);
    return true;
  });
  return { added, duplicates };
}
export function parseImport(
  text: string,
  filename: string,
  options: { autoOrganize?: boolean } = {},
): Library {
  const importBookmark = (url: string, meta: Partial<Bookmark>) =>
    makeBookmark(url, {
      ...meta,
      ...(options.autoOrganize === false && !meta.topic ? { topic: "Unsorted" as const } : {}),
    });
  const bookmarks: Bookmark[] = [];
  const lists: BookmarkList[] = [];
  const getList = (name: string) => {
    let list = lists.find((l) => folderKey(l.name) === folderKey(name));
    if (!list) {
      list = {
        id: crypto.randomUUID(),
        name: name.slice(0, 80),
        color: "lilac",
        updatedAt: Date.now(),
      };
      lists.push(list);
    }
    return list.id;
  };
  if (filename.toLowerCase().endsWith(".json")) {
    const raw = JSON.parse(text);
    if (raw.format === "nest-backup" && raw.version !== 1)
      throw Error("This backup version is not supported. Restore it with a newer Nest version.");
    const data = raw.format === "nest-backup" ? librarySchema.parse(raw.library) : raw;
    if (data.bookmarks && Array.isArray(data.bookmarks)) {
      for (const b of data.bookmarks) {
        if (b.deletedAt || b.demo) continue;
        const url = validUrl(b.url || "");
        if (url)
          bookmarks.push(
            importBookmark(url, {
              ...b,
              url,
              id: crypto.randomUUID(),
              updatedAt: Date.now(),
              deletedAt: undefined,
            }),
          );
      }
      if (Array.isArray(data.lists)) lists.push(...data.lists);
      return { bookmarks, lists };
    }
    function visit(node: Record<string, unknown>, folder?: string) {
      const url = validUrl(String(node.url || node.uri || ""));
      if (url)
        bookmarks.push(
          importBookmark(url, {
            title: String(node.name || node.title || titleFromUrl(url)),
            listIds: folder ? [getList(folder)] : [],
          }),
        );
      if (Array.isArray(node.children))
        for (const c of node.children)
          visit(
            c as Record<string, unknown>,
            String(node.name || node.title || folder || "Imported"),
          );
      if (node.roots)
        for (const root of Object.values(node.roots as object))
          visit(root as Record<string, unknown>);
    }
    visit(data);
    return { bookmarks, lists };
  }
  const doc = new DOMParser().parseFromString(text, "text/html");
  for (const a of doc.querySelectorAll("a[href]")) {
    const url = validUrl(a.getAttribute("href") || "");
    if (!url) continue;
    const folders: string[] = [];
    let p: Element | null = a.closest("dl");
    while (p) {
      const h = p.previousElementSibling;
      if (h?.tagName === "H3") folders.unshift(h.textContent || "Imported");
      else if (p.parentElement?.tagName === "DT") {
        const heading = p.parentElement.querySelector(":scope > h3");
        if (heading) folders.unshift(heading.textContent || "Imported");
      }
      p = p.parentElement?.closest("dl") || null;
    }
    const name = folders
      .filter((x) => !/^Bookmarks|Bookmarks bar|Other bookmarks$/i.test(x))
      .join(" / ");
    bookmarks.push(
      importBookmark(url, {
        title: a.textContent?.trim() || titleFromUrl(url),
        listIds: name ? [getList(name)] : [],
        createdAt: Number(a.getAttribute("add_date")) * 1000 || Date.now(),
      }),
    );
  }
  return { bookmarks, lists };
}
const stop = new Set(
  "a an the my me i find show saved bookmarks bookmark about for to from with that those please of in on articles article links link some want".split(
    " ",
  ),
);
const synonyms: Record<string, string[]> = {
  frontend: ["react", "css", "javascript", "development", "interface"],
  websites: ["web", "design", "development"],
  fonts: ["typography", "font", "design"],
  coding: ["development", "code", "programming"],
  beautiful: ["design", "inspiration"],
  nature: ["life", "living", "plant", "garden"],
  learning: ["reading", "guide", "learn", "tutorial"],
  animation: ["motion", "animation", "three", "webgl"],
  accessibility: ["accessible", "accessibility", "a11y"],
};
export function searchScore(b: Bookmark, query: string): number {
  if (!query.trim()) return 1;
  const body = [b.title, b.description, b.url, b.topic, ...b.tags, b.note || ""]
    .join(" ")
    .toLowerCase();
  const terms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && !stop.has(t));
  if (!terms.length) return 1;
  let score = 0;
  for (const term of terms) {
    if (body.includes(term)) score += b.title.toLowerCase().includes(term) ? 4 : 2;
    else if ((synonyms[term] || []).some((t) => body.includes(t))) score += 1;
  }
  return score;
}
export function exportHtml(library: Library): string {
  const esc = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
  return (
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Nest bookmarks</TITLE>\n<H1>Nest bookmarks</H1>\n<DL><p>\n' +
    library.bookmarks
      .filter((b) => !b.deletedAt && !b.demo)
      .map(
        (b) =>
          `<DT><A HREF="${esc(b.url)}" ADD_DATE="${Math.floor(b.createdAt / 1000)}">${esc(b.title)}</A>`,
      )
      .join("\n") +
    "\n</DL><p>"
  );
}
