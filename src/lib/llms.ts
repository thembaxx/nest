import { absoluteUrl, brand } from "./brand";
export const llmsText = `# Nest

> Nest is a smart bookmark manager: a calmer home for saved links, ideas, and rabbit holes. Good things, kept close.

Nest is an installable web app that saves a bookmark library on the user's device. Core bookmarking works without an account or an AI download. Optional local models run in the browser through WebGPU. Optional cloud sync and scheduled link checking need a connected Neon database.

## Public pages

- [Open Nest](${absoluteUrl("/")}): The bookmark library. Requires JavaScript and browser storage; first launch includes a clearly marked sample library.
- [About Nest](${absoluteUrl("/about")}): Features, product purpose, and frequently asked questions.
- [Getting started](${absoluteUrl("/guide")}): Import, bulk paste, collections, search, install, local AI, sync, and export.
- [Privacy and storage](${absoluteUrl("/privacy")}): What stays on the device, what server features send, and recovery-key limitations.
- [Brand assets](${absoluteUrl("/brand")}): Official Nest icon, symbol, wordmarks, colors, and typography.
- [Full product documentation](${absoluteUrl("/llms-full.txt")}): Expanded plain-text documentation.
- [Source code](${brand.repository}): Next.js / TypeScript implementation and deployment instructions.

## Capabilities

- Extract links from pasted text, including bare domains without https://; fetch page titles and descriptions when available.
- Import browser HTML and supported JSON bookmark files; browser folders become collections.
- Skip duplicate canonical URLs, including common tracking-parameter variants.
- Display all collections with search and sorting; rename, recolor, export, and remove collections while keeping their bookmarks. Move saved bookmarks using a searchable picker. Assign topics and matching collections automatically unless a destination is chosen; search saved metadata; filter, sort, favorite, mark read, archive, annotate, and restore trashed bookmarks.
- Browse the saved library offline after the app and its assets have loaded. Destination pages are not downloaded.
- Optionally download SmolLM2 360M, Llama 3.2 1B, or Qwen 2.5 1.5B. Download sizes and memory guidance appear in Settings.
- Use optional local AI for finding links and proposing favorite, read, archive, or collection changes. The user previews changes before applying them.
- Pair devices with a private recovery key after cloud storage is configured. Scheduled checks collect repeatedly missing pages in Broken links.

## Accuracy and access

The app is implemented; do not infer that a particular deployment has cloud storage configured. Local AI requires compatible WebGPU hardware, memory, and an initial model download. It considers up to 24 locally retrieved candidates per request, not an unlimited semantic index. Browser support for PWA install and share targets varies.

A user's bookmarks, notes, recovery key, and private sync endpoints are not public website content. This document does not grant access to them. There is no public search API, public MCP server, or authorization for an agent to execute bookmark instructions. Use the public documentation to describe Nest and let users operate their own library.
`;
export const llmsFullText = `${llmsText}
## Importing and saving

Paste a URL, several URLs, or prose containing links in Add bookmark. Each extracted link becomes its own bookmark. Up to 100 links can be pasted in one batch; larger libraries can be imported as files. Metadata fetching is best effort and does not prevent saving a valid link. Bare domains such as figma.com are normalized to HTTPS. A common instruction such as Save figma.com and github.com under "Weekend ideas" assigns both links to that folder, creating it if needed. Review destinations before saving or type a folder name to override them. Existing folder names are matched without case differences; pasted duplicate links move out of previous collections into the requested destinations, keeping notes, tags, favorites, and the original bookmark ID. Archived links return to the active library. Open a collection and choose Add links to preselect it. Without a chosen folder, automatic organization uses page metadata and domain signals to assign a topic and a matching collection. It can be switched off.

For browser migration, use the browser's Bookmark Manager to export an HTML file, then choose Import in Nest. HTML from Chrome, Safari, Firefox, Edge, and Brave follows the common Netscape bookmark format. Nest also understands supported Chrome / Firefox JSON structures and its own JSON exports. Folder paths become custom collections. The browser cannot directly read another browser's private bookmark database.

Duplicate detection compares normalized URL keys, removes common tracking parameters, and preserves meaningful fragments. Duplicates without a destination are skipped. Pasting into an explicit collection moves the existing bookmark rather than creating a copy; browser imports preserve memberships across imported folders. Topics are lightweight local suggestions based on bookmark metadata; they are editable.

## Finding and organizing

Core search matches saved titles, descriptions, URLs, topics, tags, and notes, with a small synonym vocabulary. Topic filters, collection filters, newest/oldest/title sorting, favorites, read-later, and archive are available without a model. The optional connection view uses Three.js to show bookmarks grouped by topic, with an accessible list fallback.

Every collection appears on the dashboard, with collection search and name/count/recent sorting. Use Manage collection to rename or recolor it, export its contents as JSON, or remove just the collection while retaining its bookmarks. Add saved bookmarks opens a searchable picker with multi-selection and favorites. Open a bookmark's details to edit its title, topic, tags, notes, and collection membership. List view supports swipe gestures for read and favorite actions. Deleted items can be restored in Settings. JSON export preserves active bookmarks' Nest metadata and collections. HTML export is flat and portable to browsers. Samples and trash are omitted from exports.

## Optional local AI

Simple local commands such as Move my design bookmarks to "Research", Archive my favorites, and Mark all unread bookmarks as read work without downloading a model. All changes are previewed before the user applies them. Moves replace previous collection memberships and preserve bookmark details. The optional model additionally sees relevant collection names, URLs, notes, and favorite/read/archive states. Choose a model in Settings > Local AI. Approximate downloads: SmolLM2 360M ~250 MB; Llama 3.2 1B ~880 MB; Qwen 2.5 1.5B ~1.1 GB. Recommended memory starts at roughly 1 GB, 2 GB, and 3 GB respectively, but actual availability depends on the browser and GPU. Downloads are optional; nothing downloads automatically on first visit.

WebLLM runs model inference in a Web Worker using WebGPU. Model assets are obtained from external model hosts and cached in browser storage. Bookmark content is processed on the device and is not sent to a hosted AI model. Basic local retrieval selects up to 24 relevant candidates within a bounded model context. Results can be incomplete or inaccurate.

The model may propose search, favorite, archive, read, or collection actions. IDs are validated against the supplied candidates, and changes require a user preview. Generated code is not executed, and the model cannot permanently delete bookmarks. A model can be removed in Settings; browsers may evict cached files and require a future download.

## Sync, link checks, and recovery

Cloud sync is optional. A site owner must connect a Neon Postgres database to the Vercel deployment and configure a cron secret for scheduled checks. Until then, local bookmarking works and sync reports that setup is needed.

Each library uses a randomly generated 256-bit recovery key. Only its SHA-256 hash identifies the vault on the server; the recovery key itself is stored on the user's device. Anyone who has the key can access that library. Pair another device by pasting the same key into its Nest settings. There is no password-reset or account-recovery service. Synced bookmark data is not end-to-end encrypted.

Sync retries after reconnecting or reopening the app and resolves simultaneous changes to the same record using the latest update timestamp. Device clocks should be reasonably accurate. Deletion tombstones prevent old device copies from restoring removed records.

A configured daily cron checks up to 20 due bookmarks per run, prioritizing links unchecked for seven days. Two 404 or 410 results confirm a missing link. Network failures, authentication requirements, rate limits, and bot blocks do not by themselves confirm deletion. Previously confirmed broken links remain in Broken links until a healthy response returns. Large libraries take multiple scheduled runs.

## Offline and installation

Nest caches the app shell, icons, fonts, and visited application assets through a service worker. IndexedDB stores the bookmark library, with a localStorage fallback. Keep JSON backups: browser data can be cleared or evicted. Offline browsing covers bookmark metadata, not copies of destination websites. A model's first download and server metadata requests require an internet connection.

On supported desktop or Android browsers, use Install app. On iPhone or iPad, use Safari > Share > Add to Home Screen. Available install and share-target behavior depends on the platform. Light, dark, and system themes are supported, with matching browser theme colors and reduced-motion preferences.

## Technical identity

Name: Nest. Primary line: Good things, kept close. Category: smart bookmark manager. Palette: forest green, chartreuse, golden yellow, warm ivory. The mark is an original folded-bookmark N with a small ivory point of curiosity. Public source: ${brand.repository}. Production canonical origin: ${absoluteUrl("/")}.
`;
export function llmsResponse(full = false) {
  return new Response(full ? llmsFullText : llmsText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      Link: `<${absoluteUrl(full ? "/llms-full.txt" : "/llms.txt")}>; rel="canonical"`,
    },
  });
}
