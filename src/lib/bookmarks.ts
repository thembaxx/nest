import type { Bookmark, BookmarkList, Library, Topic } from "./types";
export function validUrl(value: string): string | null {
  try {
    const u = new URL(value.startsWith("www.") ? "https://" + value : value);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}
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
export function extractUrls(text: string): string[] {
  return [
    ...new Set(
      (text.match(/(?:https?:\/\/|www\.)[^\s<>"'`]+/gi) || [])
        .map((v) => v.replace(/[.,;!?)\]}]+$/, ""))
        .map(validUrl)
        .filter((u): u is string => !!u),
    ),
  ];
}
const rules: Record<Exclude<Topic, "Unsorted">, RegExp> = {
  Design: /design|figma|typograph|font|color|ux|dribbble|interface|awwwards|branding/i,
  Development:
    /github|code|developer|javascript|typescript|react|nextjs|next\.js|vercel|web\.dev|css|programming|three\.js|tailwind|api|engineering/i,
  Reading: /book|essay|read|article|substack|medium|literature|journal|newsletter|writing/i,
  Inspiration: /inspir|pinterest|are\.na|art|creative|photograph|museum|architecture|unsplash/i,
  "Life & living": /travel|recipe|cook|food|garden|nature|wellness|health|living|hike|plant/i,
};
export function classify(text: string): Topic {
  for (const [topic, rule] of Object.entries(rules)) if (rule.test(text)) return topic as Topic;
  return "Unsorted";
}
export function titleFromUrl(url: string) {
  const u = new URL(url);
  const slug = u.pathname.split("/").filter(Boolean).pop();
  return slug
    ? decodeURIComponent(slug)
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
    topic: classify(url),
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
  return { bookmarks: merge(a.bookmarks, b.bookmarks), lists: merge(a.lists, b.lists) };
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
export function parseImport(text: string, filename: string): Library {
  const bookmarks: Bookmark[] = [];
  const lists: BookmarkList[] = [];
  const getList = (name: string) => {
    let list = lists.find((l) => l.name === name);
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
  if (filename.endsWith(".json")) {
    const data = JSON.parse(text);
    if (data.bookmarks && Array.isArray(data.bookmarks)) {
      for (const b of data.bookmarks) {
        const url = validUrl(b.url || "");
        if (url)
          bookmarks.push(
            makeBookmark(url, {
              ...b,
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
          makeBookmark(url, {
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
      makeBookmark(url, {
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
