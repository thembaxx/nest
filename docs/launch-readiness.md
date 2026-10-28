# Nest launch evidence

Observed on 2026-10-28. This is an independent implemented project; no customer research, adoption, revenue, or outcome metrics are claimed.

## The complete journey

The core promise is a personal library that works without an account: import exported bookmarks, organize them with collections and notes, find them again, then take a full backup to another browser.

- First-run onboarding offers import, a labeled sample library, or an empty start. A notice above the library explains samples and offers removal. Import previews let the visitor remove untouched samples. Edited samples and real imports matching sample URLs become personal records.
- Browser HTML, supported JSON, and CSV imports validate and preview before confirmation. Matching folders are reused, including sample folders that now contain personal bookmarks. Tracking variants are deduplicated. Clearing samples keeps these used folders and edited empty folders.
- Collections, notes, tags, favorites, and keyword search work locally. `Ctrl K` / `⌘ K` focuses search. Native dialogs support keyboard dismissal and focus containment; reduced-motion styles are retained.
- Full JSON and password-encrypted backups keep metadata, collections, trash, and safe preferences while excluding credentials and untouched samples. Restore validates and previews before merging. HTML exports active links for browser tools.
- A failed storage read stops initialization and preserves the existing copy. Retry and raw recovery download are available. The raw recovery file excludes settings and keys, contains private library contents, and may require manual repair; it is not a normal Nest backup.
- Failed writes keep a visible notice with retry and backup actions. Serial writes prevent an older fallback from superseding a later edit. Backup remains available for changes held only in the current tab.

The small-screen audit found a six-pixel overflow at 320px: page padding changed to 16px while topic filters retained 22px margins. The margins now match; resource links wrap in the footer. The existing editorial layout is retained.

## Reproducible checks

Environment: Node 24.19.0, the repository-declared pnpm 10.11.0, Next.js production build, Playwright Chromium. No dependencies were added and the lockfile is unchanged.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
NEXT_PUBLIC_GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com corepack pnpm build
corepack pnpm start --port 3101
BASE_URL=http://localhost:3101 NEXT_PUBLIC_GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com \
  corepack pnpm exec playwright test --project=chromium --workers=1
```

The public test client ID enables deterministic Google mocks; it is not a configured live OAuth application. Without it, Google-specific browser tests skip. `playwright.config.ts` can start an already-built production app automatically when `BASE_URL` is omitted. CI installs Chromium and runs the launch-readiness journey after the standard quality gates.

The unit suite passes 69 tests, including preservation of personal-used sample folders, edited empty folders, duplicate handling, backup encryption, restore merging, and sync reconciliation. Formatting, lint, and type checking pass. The production build generates the new case study alongside the existing public routes.

The initial broad Chromium run passed 40 of 44 tests. Its four failures exposed a checkbox test selector ambiguity and an existing empty conflict-recovery alert interfering with backup error assertions. The selector now targets the checkbox role, and the empty alert only renders when there is an error. Follow-up verification is recorded below.

Final follow-up: all **12 targeted Chromium tests passed** in 32.8 seconds against the final production build: the five launch-readiness journeys, three viewport/edge cases, and four backup/restore cases. These checks include a real browser import, duplicate review, retained sample-folder membership, search, reload, downloaded backup bytes, cross-profile restore, unreadable IndexedDB/fallback preservation, quota failure/retry and keyboard/reduced-motion use. Formatting, lint, type checking and all **69 unit tests** passed again. No application code changed after this run.

Hosted-release verification is omitted from finalization at the owner's request. The earlier read-only observations below describe the previous deployment only.

The baseline main-branch [quality run](https://github.com/thembaxx/nest/actions/runs/40644117025) failed at `format:check` and skipped later gates. Formatting is isolated in its own commit for review. The workspace’s global pnpm 11 rejected already-committed Motion versions under its release-age policy; using the repository-declared pnpm 10.11.0 installed the unchanged lockfile successfully.

## Hosted checks and external limits

The existing [live app](https://nest-iota-three.vercel.app) returned HTTP 200 before this change. A read-only Chromium smoke at 390px completed onboarding, searched the sample library for “garden,” found one result, fit the viewport, and reported no page errors. `/api/health` returned `sync: true`; that reports configured storage, not proof of a live sync transaction. The new `/case-study` route requires deployment of this branch; it returned 404 on the older production build.

Live Google consent/Drive access, Raindrop authorization, and actual WebGPU model inference were not exercised. Google automated tests use deterministic API responses. Legacy cloud sync is not end-to-end encrypted. Offline browsing preserves bookmark details, not destination websites. Browser storage can be cleared or evicted; users need backups. Timestamp conflict resolution relies on reasonably accurate device clocks.

WebKit was downloaded, but this host lacks its required GTK/Graphene/Harfbuzz/Manette/Hyphen/GLES system libraries and has no sudo. WebKit execution remains unverified in this session. The repository’s existing WebKit tests remain available for a supported host.

## Public review and help

- [Product case study](https://nest-iota-three.vercel.app/case-study)
- [Getting started and recovery guide](https://nest-iota-three.vercel.app/guide#recovery)
- [Privacy and storage](https://nest-iota-three.vercel.app/privacy)
- [Public repository](https://github.com/thembaxx/nest) — visibility confirmed through GitHub repository metadata.
- [Support and issue reports](https://github.com/thembaxx/nest/issues) — include browser, reproduction steps, and error text. Do not attach private backups, passwords, or recovery keys. There is no guaranteed response time.
