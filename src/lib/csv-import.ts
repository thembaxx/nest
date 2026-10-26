import { makeBookmark } from "./bookmarks";
import { validUrl } from "./urls";
import type { Library, BookmarkList } from "./types";

function rows(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (!field || quoted) quoted = !quoted;
      else field += c;
    } else if (c === "," && !quoted) { row.push(field); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); if (row.some(Boolean)) result.push(row);
      row = []; field = "";
    } else field += c;
  }
  if (quoted) throw Error("CSV has an unclosed quoted field.");
  row.push(field); if (row.some(Boolean)) result.push(row);
  return result;
}

export function parseCsvImport(text: string): Library {
  const lines = rows(text.replace(/^\uFEFF/, ""));
  if (!lines.length) throw Error("This CSV file is empty.");
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const index = (...names: string[]) => headers.findIndex(h => names.includes(h));
  const urlIndex = index("url", "link", "href", "website", "address");
  if (urlIndex < 0) throw Error("CSV needs a URL or Link column.");
  const titleIndex = index("title", "name");
  const descriptionIndex = index("description", "excerpt", "summary");
  const tagsIndex = index("tags", "tag");
  const folderIndex = index("folder", "collection", "category");
  const lists: BookmarkList[] = [];
  const folders = new Map<string, string>();
  const bookmarks: Library["bookmarks"] = [];
  for (const line of lines.slice(1)) {
    const url = validUrl((line[urlIndex] || "").trim());
    if (!url) continue;
    const folder = folderIndex >= 0 ? (line[folderIndex] || "").trim().slice(0, 80) : "";
    let id = folder ? folders.get(folder.toLowerCase()) : undefined;
    if (folder && !id) {
      id = crypto.randomUUID(); folders.set(folder.toLowerCase(), id);
      lists.push({ id, name: folder, color: "lilac", updatedAt: Date.now() });
    }
    bookmarks.push(makeBookmark(url, {
      title: titleIndex >= 0 ? line[titleIndex]?.trim() || undefined : undefined,
      description: descriptionIndex >= 0 ? line[descriptionIndex]?.trim() || "" : "",
      tags: tagsIndex >= 0 ? (line[tagsIndex] || "").split(/[;|]/).map(t => t.trim()).filter(Boolean) : [],
      listIds: id ? [id] : [],
    }));
  }
  return { bookmarks, lists };
}
