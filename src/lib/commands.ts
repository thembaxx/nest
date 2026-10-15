import type { Library, Bookmark } from "./types";
import { searchScore } from "./bookmarks";
import { folderKey, cleanFolderName } from "./paste";
import { ingestBookmarks } from "./organize";
export type AIPlan = {
  action: "search" | "favorite" | "archive" | "read" | "move";
  ids: string[];
  listName?: string;
  explanation: string;
};
export function bookmarkContext(bookmark: Bookmark, library: Library) {
  return {
    ...bookmark,
    note: [
      bookmark.note,
      ...library.lists
        .filter((list) => !list.deletedAt && bookmark.listIds.includes(list.id))
        .map((list) => list.name),
    ]
      .filter(Boolean)
      .join(" "),
  };
}
export function planLocalCommand(prompt: string, library: Library): AIPlan | null {
  const text = prompt.trim();
  const command = text.match(
    /^(?:please\s+)?(move|put|file|favorite|favourite|archive|mark)\s+(.+)$/i,
  );
  if (!command) return null;
  const verb = command[1].toLowerCase();
  let selector = command[2].trim();
  let action: AIPlan["action"] =
    verb === "favourite"
      ? "favorite"
      : verb === "put" || verb === "file"
        ? "move"
        : verb === "mark"
          ? "read"
          : (verb as AIPlan["action"]);
  let listName: string | undefined;
  if (action === "move") {
    const destination = selector.match(
      /^(.+?)\s+(?:to|into|under|in)\s+(?:(?:a|the|my|new)\s+)?(?:(?:collection|folder)(?:\s+(?:called|named))?\s+)?(.+)$/i,
    );
    if (!destination) return null;
    selector = destination[1];
    listName = cleanFolderName(
      destination[2].replace(/[.!]+$/, "").replace(/^["“'‘]|["”'’]$/g, ""),
    );
    if (!listName) return null;
  } else if (verb === "mark") {
    if (!/\s+(?:as\s+)?read[.!]?$/i.test(selector)) return null;
    selector = selector.replace(/\s+(?:as\s+)?read[.!]?$/i, "");
    action = "read";
  }
  const source = selector.match(
    /\b(?:from|in)\s+(?:the\s+)?(?:collection\s+|folder\s+)?["“']([^"”']+)["”']/i,
  );
  const sourceList = source
    ? library.lists.find((list) => !list.deletedAt && folderKey(list.name) === folderKey(source[1]))
    : undefined;
  if (source && !sourceList)
    return {
      action,
      ids: [],
      listName,
      explanation: `No collection named “${source[1]}” was found.`,
    };
  const favorites = /\bfavou?rites?\b/i.test(selector);
  const unread = /\bunread\b|\bread later\b/i.test(selector);
  const archived = /\barchived\b/i.test(selector);
  const all = /\ball\b|\bevery\b/i.test(selector);
  let terms = selector
    .replace(source?.[0] || /$^/, "")
    .replace(
      /\b(?:all|every|my|the|these|those|saved|bookmarks?|links?|articles?|favou?rites?|unread|archived|please)\b/gi,
      " ",
    )
    .replace(/read later/gi, " ")
    .replace(/["“”'.,!]/g, " ")
    .trim();
  const topic = library.bookmarks
    .map((bookmark) => bookmark.topic)
    .find(
      (value) =>
        value !== "Unsorted" &&
        new RegExp(
          `\\b${value === "Life & living" ? "(?:life|living|gardening)" : value}\\b`,
          "i",
        ).test(terms),
    );
  if (topic)
    terms = terms
      .replace(
        new RegExp(
          topic === "Life & living" ? "\\b(?:life|living|gardening)\\b" : `\\b${topic}\\b`,
          "gi",
        ),
        "",
      )
      .trim();
  if (!all && !favorites && !unread && !archived && !source && !topic && !terms) return null;
  // Complex requests belong to the optional model; avoid broad partial keyword matches for edits.
  if (/\b(?:except|unless|without|before|after|older|newer|but|not)\b/i.test(terms)) return null;
  const ids = library.bookmarks
    .filter(
      (bookmark) =>
        !bookmark.deletedAt &&
        (archived ? bookmark.archived : !bookmark.archived) &&
        (!favorites || bookmark.favorite) &&
        (!unread || !bookmark.read) &&
        (!sourceList || bookmark.listIds.includes(sourceList.id)) &&
        (!topic || bookmark.topic === topic) &&
        (!terms || searchScore(bookmarkContext(bookmark, library), terms) > 0),
    )
    .map((bookmark) => bookmark.id);
  return {
    action,
    ids,
    listName,
    explanation: ids.length
      ? `${action === "move" ? `Move ${ids.length} bookmark${ids.length === 1 ? "" : "s"} into “${listName}”, replacing previous collection memberships` : `${action === "read" ? "Mark as read" : action === "favorite" ? "Favorite" : "Archive"} ${ids.length} bookmark${ids.length === 1 ? "" : "s"}`}. Review the selection below before applying.`
      : "No saved bookmarks match that instruction. Try a topic, collection name, or a few words from the title.",
  };
}
export function applyPlan(library: Library, plan: AIPlan): Library {
  const ids = new Set(plan.ids);
  const chosen = library.bookmarks.filter(
    (bookmark) => ids.has(bookmark.id) && !bookmark.deletedAt,
  );
  if (!chosen.length || plan.action === "search") return library;
  if (plan.action === "move") {
    const name = cleanFolderName(plan.listName || "");
    if (!name) throw Error("Name a destination collection in your instruction.");
    const incoming = chosen.map((bookmark) => ({ ...bookmark, id: crypto.randomUUID() }));
    return ingestBookmarks(library, incoming, [], {
      moveExisting: true,
      autoOrganize: false,
      folders: Object.fromEntries(incoming.map((bookmark) => [bookmark.id, name])),
    }).library;
  }
  const now = Date.now();
  return {
    ...library,
    bookmarks: library.bookmarks.map((bookmark) =>
      ids.has(bookmark.id) && !bookmark.deletedAt
        ? {
            ...bookmark,
            ...(plan.action === "favorite"
              ? { favorite: true }
              : plan.action === "archive"
                ? { archived: true }
                : { read: true }),
            demo: false,
            updatedAt: Math.max(now, bookmark.updatedAt + 1),
          }
        : bookmark,
    ),
  };
}

export function parseModelPlan(raw: string, candidateIds: string[]): AIPlan {
  let data;
  try {
    data = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    throw Error("The model could not create a valid plan. Try a simpler instruction.");
  }
  if (
    !data ||
    !["search", "favorite", "archive", "read", "move"].includes(data.action) ||
    !Array.isArray(data.ids)
  )
    throw Error("The model could not create a valid plan. Try a simpler instruction.");
  const allowed = new Map(candidateIds.map((id, index) => [`b${index}`, id]));
  const ids = [
    ...new Set<string>(data.ids.filter((id: unknown) => typeof id === "string" && allowed.has(id))),
  ].map((id) => allowed.get(id)!);
  const listName = typeof data.listName === "string" ? cleanFolderName(data.listName) : undefined;
  if (data.action === "move" && !listName)
    throw Error("Name a destination collection in your request.");
  return {
    action: data.action,
    ids,
    listName,
    explanation: String(data.explanation || "Here’s what I found.").slice(0, 500),
  };
}
