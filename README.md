# Nest

Good things, kept close. A personal, offline-first bookmark app inspired by quiet editorial layouts, pastel collections, and botanical details.

## Run

Requires Node 22+ and pnpm.

```sh
pnpm install
pnpm dev
```

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm build
pnpm start
pnpm exec playwright test
pnpm format:check
```

Next.js App Router, TypeScript, Tailwind CSS 4, Motion, IndexedDB, Three.js, PixiJS, WebLLM, Neon Postgres, oxfmt, and oxlint. Canvas effects load on demand: Three.js powers the topic connection view; PixiJS adds a short save celebration. Motion respects reduced-motion preferences.

## Included

- Bulk link extraction with metadata fetching, topic suggestions, tracking-insensitive duplicate detection, search, topic filters, sorting, grid/list views, favorites, read-later, archive, trash restoration, tags, and personal notes.
- Custom collections and imports from Netscape HTML (Chrome, Safari, Edge, Brave, Firefox), browser JSON, or a Nest JSON backup. HTML exports open in other browsers; JSON keeps Nest metadata.
- Local storage in IndexedDB with a localStorage fallback; a sample library explicitly marked in the UI. Samples never sync and are omitted from export.
- Optional cloud sync using a 256-bit recovery key. Only its SHA-256 hash identifies the vault on the server. The key is a bearer credential: keep it safe, share only between your own devices, and use HTTPS. There is no account recovery. Data is stored in the database, not end-to-end encrypted.
- Per-record last-write-wins sync with deletion tombstones, offline queues, periodic retries, and visibility-triggered refresh. Concurrent edits to the same bookmark resolve to its newest version. Device clocks should be reasonably accurate.
- Optional on-device models: SmolLM2 360M, Llama 3.2 1B, and Qwen 2.5 1.5B. No model downloads automatically. Search and command planning use WebGPU via WebLLM in a worker; model assets cache in browser storage. Commands are validated against existing IDs and previewed before execution. No generated code executes, and the model cannot delete bookmarks. Uses basic local retrieval across the library, then asks the model to interpret up to 24 relevant candidates within a 4,096-token context. Browser support and available GPU memory vary.
- Scheduled link checks. Only two consecutive 404/410 results mark a link dead; timeouts, bot blocks, authentication failures, and other ambiguous errors remain unverified. Missing links stay recoverable. A healthy response restores their status.
- Installable PWA: icons, maskable icon, standalone mode, share target, add-bookmark shortcut, cached shell/assets, offline library, safe areas, light/dark/system theme, early theme initialization, browser chrome colors, and swipe gestures in list view.

## Vercel setup

The application works locally without any cloud credentials. For sync and scheduled checks:

1. Import `thembaxx/nest` in Vercel; choose Next.js and the repository root.
2. In the project Storage tab, connect a **free Neon** database. The integration injects `DATABASE_URL`. `POSTGRES_URL` is also accepted. No database secret belongs in a `NEXT_PUBLIC_` variable.
3. Set an encrypted/sensitive `CRON_SECRET` (at least 32 random bytes) in production. The initial deployment configures this automatically when tools permit.
4. Redeploy after changing environment variables. Tables and indexes initialize on the first authenticated sync, using idempotent DDL.
5. In Nest, open Settings → Sync & data → Enable sync. Save the recovery key, then paste it into the same settings on another device.

`vercel.json` runs `/api/cron/check-links` daily at 04:00 UTC, compatible with a Hobby daily cron. The job examines up to 20 records per run, prioritizing those unchecked for seven days. Larger libraries take multiple runs. Turning link checks off in Settings updates the vault preference on its next sync. Samples and deleted records are never checked.

`GET /api/health` reports whether a database environment variable is configured, without disclosing credentials. The API returns a clear 503 when storage is missing. Sync and metadata have best-effort per-instance request limits; production deployments at large scale should add a shared rate limit and database quotas.

Metadata and link requests allow only public HTTP(S) addresses on standard ports, validate all DNS answers, pin those answers in the connection, revalidate redirects, use deadlines, and limit response size. Private network targets are rejected.

## Limits and verification

HTML imports preserve folder names as collections. HTML export is flat; use JSON for a complete backup. A browser cannot directly read another browser’s bookmark database, so use its export function. Offline support covers the app and bookmark metadata, not full copies of destination pages. WebLLM’s first download requires internet and compatible WebGPU hardware; browser storage eviction can require downloading again. PWA install and receiving shared links depend on browser support. Three.js has an accessible list fallback.

Automated checks cover link extraction, canonicalization, deduplication, safe exports, sync conflict/tombstone merging, URL/IP validation, schema validation, browser imports, library interactions, mobile layout, theme changes, and offline reloads. Actual GPU model inference and cloud sync require their corresponding hardware/service and are reported separately in release notes.

## Branding and discovery

Nest's identity pairs a sculpted folded-bookmark N with a simple vector symbol and an outlined wordmark. The supplied app-icon image informed the dimensional materials, strong silhouette, and squircle framing. The brand kit is available at `/brand`, and the source guidelines are in `docs/brand.md`. Regenerate derivative assets with `pnpm brand:assets`.

Public, server-rendered About, Guide, Brand, and Privacy pages provide indexable product content. Metadata includes stable production canonicals, Open Graph and Twitter images, favicons, a sitemap, robots rules, and truthful WebApplication / WebSite / FAQ structured data. Preview deployments receive `noindex` directives. Private bookmark records are never included in the sitemap or LLM documents.

`/llms.txt` is the conventional model-readable product index. `/llm.txt` is a singular alias, and `/llms-full.txt` contains the expanded guide and limitations. These files describe the product; they don't expose a user's library or grant permission to use private APIs. LLM discovery files are a community convention and do not guarantee model ingestion, citations, or ranking.

The canonical origin defaults to `https://nest-iota-three.vercel.app`. When adding a custom domain, set `NEXT_PUBLIC_SITE_URL` to its public HTTPS origin and redeploy to update metadata, sitemap, and documentation links. No search-engine ranking or indexing outcome is guaranteed by these technical changes.

Pasted links can omit `https://`. For example, `Save figma.com and github.com under "Weekend ideas"` previews both destinations, creates the folder on save if needed, and reuses matching names regardless of case. Open a collection and choose **Add links** to preselect it. Existing pasted links move out of previous collections into the chosen destinations without replacing their notes, tags, favorites, or IDs. Archived matches return to the active library; imported browser folders retain their memberships. Automatic organization assigns topics and matching collections when no folder is chosen; it can be disabled. The same destination preview works when links are pasted into Ask Nest, without downloading a model. All native input fields use 16px text and interface icons use Phosphor.

The collection shelf shows every active collection, with search and sorting by name, bookmark count, or recent changes. Collection tools support rename, color, JSON export, removal without deleting bookmarks, and a searchable saved-bookmark picker. Simple scoped instructions (move, favorite, archive, mark read) work locally without a model download and preview changes before applying. Optional model context includes collection names, URLs, notes, and bookmark states. Sync protects personal records from sample data when pairing devices.
