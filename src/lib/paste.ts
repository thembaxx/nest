import { findLinks } from "./urls";

export function cleanFolderName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 80);
}
export function folderKey(value: string) {
  return cleanFolderName(value).toLocaleLowerCase();
}
function folderInstruction(value: string): string | undefined {
  const text = value.trim();
  const hasIntent =
    /\b(?:save|add|put|file|place|organize|move|keep|tuck|folder|collection|under|into|inside)\b|->|→/i.test(
      text,
    );
  const match = hasIntent
    ? text.match(
        /(?:\b(?:under|into|inside|in|to)\s+(?:(?:a|the|my|new)\s+)*(?:(?:folder|collection)(?:\s+(?:called|named))?\s*:?\s+)?|\b(?:folder|collection)\s+(?:called|named)\s+|\b(?:create|make)\s+(?:(?:a|the|new)\s+)*(?:folder|collection)\s+(?:(?:called|named)\s+)?|\b(?:folder|collection)\s*:\s*|(?:^|\s)(?:->|→)\s*)([\s\S]+)$/i,
      )
    : null;
  let name = match?.[1];
  if (!name) {
    const heading = text.match(/^(?:#{1,3}\s+(.+?)\s*#*|([^:]+):)\s*$/);
    name = heading?.[1] || heading?.[2];
  }
  if (!name) return undefined;
  const quoted = name.match(/^["“'‘]([^"”'’]+)["”'’]/);
  if (quoted) name = quoted[1];
  else
    name = name
      .replace(
        /\s*[,;.!]?\s*(?:and\s+)?(?:create|creating|make|if it|if (?:the )?(?:folder|collection)|please|that doesn['’]t exist)\b[\s\S]*$/i,
        "",
      )
      .replace(/\s+and\s+(?:add|save|put|file|place)\b[\s\S]*$/i, "")
      .replace(/\s+(?:folder|collection)\b[\s\S]*$/i, "")
      .replace(/[.,;:!]+$/, "");
  name = cleanFolderName(name);
  if (!name || /^(?:it|them|these|there|here|my library|the library)$/i.test(name))
    return undefined;
  return name;
}
export type PastedBookmark = { url: string; folderName?: string; context: string };
export function parsePaste(text: string): PastedBookmark[] {
  const lines = text.split(/\r?\n/).map((line) => {
    const links = findLinks(line);
    let withoutLinks = line;
    for (const link of [...links].reverse())
      withoutLinks = withoutLinks.slice(0, link.start) + " " + withoutLinks.slice(link.end);
    return { links, withoutLinks, folder: folderInstruction(withoutLinks) };
  });
  const standalone = lines
    .filter((line) => !line.links.length && line.folder)
    .map((line) => line.folder!);
  const singleGlobal = new Set(standalone.map(folderKey)).size === 1 ? standalone[0] : undefined;
  const entries: PastedBookmark[] = [];
  let section = singleGlobal;
  for (const line of lines) {
    if (line.folder) section = line.folder;
    for (const link of line.links) {
      const folderName = line.folder || section;
      // Instructions and folder names are destinations, not evidence about a link's topic.
      const context = line.folder ? "" : line.withoutLinks.trim().replace(/^[#\s:*-]+/, "");
      const existing = entries.find(
        (entry) =>
          entry.url === link.url &&
          folderKey(entry.folderName || "") === folderKey(folderName || ""),
      );
      if (!existing) entries.push({ url: link.url, folderName, context });
    }
  }
  return entries;
}
