# Nest

An offline-first personal bookmark library with collections, search, imports, exports and optional cloud sync.

[Browse the source](https://github.com/thembaxx/nest)

## Engineering highlights

IndexedDB persistence, duplicate detection and per-record sync reconciliation. Google Drive sync encrypts data on the device; portable backups support password encryption. Legacy server sync uses bearer recovery keys and is not end-to-end encrypted.

## Technology

Declared in [package.json](package.json): Next.js `^16.0.0` · React `^19.2.0` · TypeScript `^5.9.0` · Tailwind CSS `^4.1.0` · Three.js `^0.180.0` · Motion `^12.23.0` · PixiJS `^8.13.0` · WebLLM `^0.2.79` · Zod `^4.0.0`.

**Quality tooling:** `lint`, `format:check`, `typecheck`, `test` scripts are available. See the setup guide below for prerequisites. Live Google consent needs a configured OAuth client; automated Google tests mock external responses.

---

## Project guide

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
pnpm exec playwright install --with-deps chromium webkit
pnpm build
pnpm start
pnpm exec playwright test
pnpm format:check
```

To exercise Google flows without an external account, build and run Playwright with
`NEXT_PUBLIC_GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com`. The Google
identity and Drive responses in `tests/sync-data.spec.ts` are mocked. Without this
variable those two Google browser tests are skipped; backup and restore still run.

Next.js App Router, TypeScript, Tailwind CSS 4, Motion, IndexedDB, Three.js, PixiJS, WebLLM, Neon Postgres, oxfmt, and oxlint. Canvas effects load on demand: Three.js powers the topic connection view; PixiJS adds a short save celebration. Motion respects reduced-motion preferences.

## Included

- Bulk link extraction with metadata fetching, topic suggestions, tracking-insensitive duplicate detection, search, topic filters, sorting, grid/list views, favorites, read-later, archive, trash restoration, tags, and personal notes.
- Custom collections and imports from Netscape HTML (Chrome, Safari, Edge, Brave, Firefox), browser JSON, or a Nest JSON backup. HTML exports open in other browsers; JSON keeps Nest metadata.
- Local storage in IndexedDB with a localStorage fallback; a sample library explicitly marked in the UI. Untouched samples never sync and are omitted from export; editing a sample keeps it as a personal bookmark.
- Optional Google Drive sync stores AES-256-GCM encrypted per-device snapshots in the hidden appDataFolder, using only the `drive.appdata` scope. A random 256-bit recovery key stays on the device. The Google account and the same key are required on another device. Google access tokens stay in memory and require reconnecting after a reload or expiration. Concurrent device edits merge using record timestamps and deletion tombstones. No Nest database is required.
- Portable, versioned backups include notes, tags, collections, trash and safe preferences, omit samples and credentials, and support password encryption using PBKDF2-SHA256 (600,000 iterations) and AES-256-GCM. Restore validates and previews files before merging with existing records; older JSON exports are supported. Maximum file size: 20 MB. HTML remains a flat active-link export.
- Legacy cloud sync using a 256-bit recovery key. Only its SHA-256 hash identifies the vault on the server. The key is a bearer credential: keep it safe, share only between your own devices, and use HTTPS. There is no account recovery. Data is stored in the database, not end-to-end encrypted.
- Per-record last-write-wins sync with deletion tombstones, offline queues, periodic retries, and visibility-triggered refresh. Concurrent edits to the same bookmark resolve to its newest version. Device clocks should be reasonably accurate.
- Optional on-device models: SmolLM2 360M, Llama 3.2 1B, and Qwen 2.5 1.5B. No model downloads automatically. Search and command planning use WebGPU via WebLLM in a worker; model assets cache in browser storage. Commands are validated against existing IDs and previewed before execution. No generated code executes, and the model cannot delete bookmarks. Uses basic local retrieval across the library, then asks the model to interpret up to 24 relevant candidates within a 4,096-token context. Browser support and available GPU memory vary.
- Scheduled link checks. Only two consecutive 404/410 results mark a link dead; timeouts, bot blocks, authentication failures, and other ambiguous errors remain unverified. Missing links stay recoverable. A healthy response restores their status.
- Installable PWA: icons, maskable icon, standalone mode, share target, add-bookmark shortcut, cached shell/assets, offline library, safe areas, light/dark/system theme, early theme initialization, browser chrome colors, and swipe gestures in list view.

For the free sync options, device transfer, and compatibility with older Google libraries and backups, see [the sync and recovery guide](docs/sync.md).

## Google Drive setup

1. In Google Cloud Console, enable **Google Drive API** and configure the OAuth consent screen (Google Auth Platform). During testing, add your Google account as a test user. Testing-mode permissions and consent expire according to Google’s policies; publish/verify the application as required before a public rollout.
2. Create an OAuth **Web application** client. Add each exact app origin (for example, `http://localhost:3000` and the production HTTPS origin) to **Authorized JavaScript origins**. Arbitrary preview origins do not inherit production permission. The GIS token popup flow does not use an application redirect route or client secret.
3. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to that public client ID and rebuild/redeploy. Never add an OAuth client secret to the browser. Without the ID, encrypted local backup and restore remain available.
4. Open Settings → Sync & data → Set up Google Drive. Grant only `https://www.googleapis.com/auth/drive.appdata`. Save the displayed recovery key outside the browser. Another device must enter that key under “Already syncing on another device?” and choose the same Google account.
5. Reconnect Google after reopening Nest or when the short-lived token expires. Sync runs after changes, on reconnection, on returning to the tab, and every 30 seconds while connected. The browser must support HTTPS Web Crypto and Web Locks (localhost is supported for development).

Google receives encrypted payloads directly from the browser; neither plaintext nor the recovery key is sent to Nest’s sync endpoint in this mode. Google still sees account and request metadata. Local IndexedDB contents and locally remembered keys are readable to someone with access to the unlocked browser. A copied backup excludes recovery keys, so keep the Drive key separately if you also want to reconnect sync after restoring.

Each browser keeps a separate snapshot containing the merged library, including tombstones. Web Locks serialize writers across tabs on the same browser. Simultaneous devices write separate files so an upload cannot replace another device’s unseen changes. Every encrypted snapshot must decrypt and validate before any upload; older readable snapshots from the earlier integration are validated and merged into the new encrypted copy. Those older files are retained; see the recovery guide for cleanup. A wrong key or damaged snapshot fails without overwriting Drive data. Unchanged snapshots do not upload again. The current limit is 200 device snapshots and 20 MB per encrypted file. Old snapshots are retained to preserve deletions; automatic compaction/key rotation is not implemented. Accurate device clocks are needed for last-write-wins conflicts. Google Drive Manage apps can remove Nest’s hidden application data; disconnecting Nest only stops the current device and retains copies.

The recovery key is persisted locally before the first upload, including a pending connection if the network response is lost. Tokens are never put in URLs, localStorage, IndexedDB, or backups. No Google script loads on the library screen; it loads only when preparing Google sign-in in Sync & data. A blocked/closed popup reports an error and can be retried. Scheduled server link checks cannot inspect encrypted Drive libraries. Switching to Drive stops legacy sync on this device but does not erase old server records or revoke other devices.

## Vercel setup (legacy server sync)

The application works locally without any cloud credentials. For legacy server sync and scheduled checks:

1. Import `thembaxx/nest` in Vercel; choose Next.js and the repository root.
2. In the project Storage tab, connect a **free Neon** database. The integration injects `DATABASE_URL`. `POSTGRES_URL` is also accepted. No database secret belongs in a `NEXT_PUBLIC_` variable.
3. Set an encrypted/sensitive `CRON_SECRET` (at least 32 random bytes) in production. The initial deployment configures this automatically when tools permit.
4. Redeploy after changing environment variables. Tables and indexes initialize on the first authenticated sync, using idempotent DDL.
5. In Nest, open Settings → Sync & data → Legacy Nest cloud sync → Enable legacy sync. Save the recovery key, then paste it into the same settings on another device.

`vercel.json` runs `/api/cron/check-links` daily at 04:00 UTC, compatible with a Hobby daily cron. The job examines up to 20 records per run, prioritizing those unchecked for seven days. Larger libraries take multiple runs. Turning link checks off in Settings updates the vault preference on its next sync. Samples and deleted records are never checked.

`GET /api/health` reports whether a database environment variable is configured, without disclosing credentials. The API returns a clear 503 when storage is missing. Sync and metadata have best-effort per-instance request limits; production deployments at large scale should add a shared rate limit and database quotas.

Metadata and link requests allow only public HTTP(S) addresses on standard ports, validate all DNS answers, pin those answers in the connection, revalidate redirects, use deadlines, and limit response size. Private network targets are rejected.

## Limits and verification

HTML imports preserve folder names as collections. HTML export is flat; use a full JSON or encrypted .nest backup for device transfer. A browser cannot directly read another browser’s bookmark database, so use its export function. Offline support covers the app and bookmark metadata, not full copies of destination pages. WebLLM’s first download requires internet and compatible WebGPU hardware; browser storage eviction can require downloading again. PWA install and receiving shared links depend on browser support. Three.js has an accessible list fallback.

Automated checks cover link extraction, canonicalization, deduplication, safe exports, sync conflict/tombstone merging, URL/IP validation, schema validation, browser imports, library interactions, mobile layout, theme changes, and offline reloads. Actual GPU model inference and live Google consent/Drive access require their corresponding hardware/service. Automated Drive tests use deterministic API responses, and browser tests exercise encryption, device pairing, and restore without external accounts.

## Branding and discovery

Nest's identity pairs a sculpted folded-bookmark N with a simple vector symbol and an outlined wordmark. The supplied app-icon image informed the dimensional materials, strong silhouette, and squircle framing. The brand kit is available at `/brand`, and the source guidelines are in `docs/brand.md`. Regenerate derivative assets with `pnpm brand:assets`.

Public, server-rendered About, Guide, Brand, and Privacy pages provide indexable product content. Metadata includes stable production canonicals, Open Graph and Twitter images, favicons, a sitemap, robots rules, and truthful WebApplication / WebSite / FAQ structured data. Preview deployments receive `noindex` directives. Private bookmark records are never included in the sitemap or LLM documents.

`/llms.txt` is the conventional model-readable product index. `/llm.txt` is a singular alias, and `/llms-full.txt` contains the expanded guide and limitations. These files describe the product; they don't expose a user's library or grant permission to use private APIs. LLM discovery files are a community convention and do not guarantee model ingestion, citations, or ranking.

The canonical origin defaults to `https://nest-iota-three.vercel.app`. When adding a custom domain, set `NEXT_PUBLIC_SITE_URL` to its public HTTPS origin and redeploy to update metadata, sitemap, and documentation links. No search-engine ranking or indexing outcome is guaranteed by these technical changes.

Pasted links can omit `https://`. For example, `Save figma.com and github.com under "Weekend ideas"` previews both destinations, creates the folder on save if needed, and reuses matching names regardless of case. Open a collection and choose **Add links** to preselect it. Existing pasted links move out of previous collections into the chosen destinations without replacing their notes, tags, favorites, or IDs. Archived matches return to the active library; imported browser folders retain their memberships. Automatic organization assigns topics and matching collections when no folder is chosen; it can be disabled. The same destination preview works when links are pasted into Ask Nest, without downloading a model. All native input fields use 16px text and interface icons use Phosphor.

The collection shelf shows every active collection, with search and sorting by name, bookmark count, or recent changes. Collection tools support rename, color, JSON export, removal without deleting bookmarks, and a searchable saved-bookmark picker. Open the options button beside a collection in the sidebar or choose **Manage collection** inside it. Bookmark cards inside a collection also let you remove individual links from that collection while keeping them in the library. Bookmark details support renaming, membership changes, and trash; restore trashed links in **Settings → Sync & data**. Simple scoped instructions (move, favorite, archive, mark read) work locally without a model download and preview changes before applying. Optional model context includes collection names, URLs, notes, and bookmark states. Sync protects personal records from sample data when pairing devices.

Page palettes live in `src/lib/page-palette.ts`, shared by initial HTML, CSS, the PWA manifest, and the edge controller. Full-width fixed edge strips sit directly under `body`, outside transformed app content. Regions declare `data-edge-background="page"`, `"surface"`, `"sidebar"`, or an opaque CSS color; the controller paints the region, samples the regions adjacent to each visible viewport edge, and shares those colors with the strips, document backgrounds, and theme-color tags. Scroll restoration, visual viewport changes, theme changes, and resizing schedule a single animation-frame update. Route cleanup removes listeners and restores owned document styles and metadata. Browser tests cover Chromium and mobile WebKit geometry, scrolling, restoration, themes, and cleanup.


### Raindrop.io direct import

Register an OAuth application at Raindrop.io and configure `RAINDROP_CLIENT_ID` and `RAINDROP_CLIENT_SECRET` in the deployment environment. Add `https://YOUR-NEST-DOMAIN/api/import/raindrop/callback` as its redirect URL. Open **Import → Connect Raindrop**, authorize access, then select **Load connected bookmarks** to preview and confirm. The import uses a short-lived, HTTP-only cookie and does not enable ongoing sync. JSON exports from Raindrop and Linkwarden, and CSV exports with a URL/Link column, can also be imported locally. Never expose the client secret as a `NEXT_PUBLIC_` variable.
