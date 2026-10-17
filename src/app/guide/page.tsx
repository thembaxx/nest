import Link from "next/link";
import { ArrowUpRight, Command } from "@phosphor-icons/react/ssr";
import { PublicSite, PageIntro } from "@/components/public-site";
import { pageMetadata } from "@/lib/brand";
export const metadata = pageMetadata(
  "A little guide to Nest",
  "Learn how to import bookmarks, save multiple links, organize collections, search, install Nest, and choose optional local AI or cloud sync.",
  "/guide",
);
const sections = [
  {
    id: "save",
    number: "01",
    title: "Save what sparks something.",
    body: (
      <>
        <p>
          Open Nest and choose <strong>Add bookmark</strong>. Paste a link, a handful of links, or
          any text containing URLs, including addresses without https://. Each link becomes its own
          bookmark. Nest detects duplicates and fetches the page title and description when it can.
        </p>
        <p>
          Try <strong>Save figma.com and github.com under &quot;Weekend ideas&quot;</strong>. Nest
          uses that folder or creates it when you save. Review each destination, or type another
          folder name to override the instruction. Already-saved links move out of their previous
          collections into the requested folder without losing notes. Open a collection and choose
          Add links to save directly into it.
        </p>
      </>
    ),
  },
  {
    id: "import",
    number: "02",
    title: "Bring your bookmarks home.",
    body: (
      <>
        <p>
          In your browser’s Bookmark Manager, choose <strong>Export bookmarks</strong> and save the
          HTML file. In Nest, choose <strong>Import</strong> and drop in the file.
        </p>
        <p>
          HTML exports from Chrome, Safari, Firefox, Edge, and Brave work with Nest. Folders become
          collections. Supported browser JSON files and Nest JSON backups are also welcome. Nest
          can’t directly read another browser’s private bookmark database.
        </p>
      </>
    ),
  },
  {
    id: "organize",
    number: "03",
    title: "A little order, your way.",
    body: (
      <>
        <p>
          Every collection appears on your dashboard. Search or sort the collection shelf, and use
          Manage collection to rename, recolor, export, or remove a collection while keeping its
          bookmarks. The options button beside each sidebar collection opens the same tools. Choose
          Add saved bookmarks to move existing links using a searchable picker. Create a collection
          from the sidebar. Inside a collection, use a bookmark’s folder-minus button to remove only
          its membership; the link stays in your library. Open Edit bookmark to rename a link,
          change its collections, topic or tags, and leave a note for your future self.
        </p>
        <p>
          With automatic organization on, new links without a chosen folder get a topic and a
          matching collection. Explicit folders and imported folders take priority. You can switch
          this off in Settings. Paste up to 100 links at a time, or import a file for larger
          batches. Favorites keep the best things close. Read later gathers unread bookmarks.
          Archive tucks things out of the way, and items moved to trash can be restored from
          Settings.
        </p>
      </>
    ),
  },
  {
    id: "find",
    number: "04",
    title: "Follow the thought.",
    body: (
      <>
        <p>
          Search the words you remember: titles, page descriptions, URLs, topics, tags, or notes.
          Use topic filters and collections to narrow the trail, and sort by newest, oldest, title,
          or relevance.
        </p>
        <p>
          Press{" "}
          <kbd>
            <Command size={12} aria-label="Command" /> K
          </kbd>{" "}
          or <kbd>Ctrl K</kbd> to jump into search. In list view, swipe right to mark a bookmark
          read or left to favorite it.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    number: "05",
    title: "Meet your optional companion.",
    body: (
      <>
        <p>
          Choose <strong>Settings → Local AI</strong> to see available models, approximate download
          sizes, and memory guidance. Nothing downloads automatically. Simple commands such as “Move
          my design bookmarks to Research” and “Archive my favorites” work without a model and show
          a preview before applying.
        </p>
        <p>
          SmolLM2 360M is about 250 MB, Llama 3.2 1B about 880 MB, and Qwen 2.5 1.5B about 1.1 GB.
          You’ll need WebGPU support, enough free memory, and internet for the first download.
          Browsers can evict cached model files.
        </p>
        <p>
          Try “Find my gardening bookmarks” or “Add my design links to Weekend ideas.” Local
          retrieval selects up to 24 relevant bookmarks per request. AI changes are shown as a plan
          before you apply them; the model can’t permanently delete bookmarks.
        </p>
      </>
    ),
  },
  {
    id: "sync",
    number: "06",
    title: "Wherever you land.",
    body: (
      <>
        <p>
          Your library is saved in this browser first. When Google sync is available, open{" "}
          <strong>Settings → Sync & data → Set up Google Drive</strong> and choose your Google
          account.
        </p>
        <p>
          Save the recovery key somewhere safe. On another device, open Sync & data, paste that key
          under Already syncing on another device, and connect the same Google account. Your library
          is encrypted before upload to Google’s hidden Nest app storage. You need both access to
          the Google account and the recovery key. Lost keys cannot be recovered. Reconnect Google
          after reopening Nest or when sign-in expires; local changes wait safely on the device.
        </p>
        <p>
          Changes merge automatically while Nest is open and connected. The latest edit to each
          record wins, so device clocks should be accurate. Trash remains recoverable. Legacy Nest
          cloud sync is available separately and is not end-to-end encrypted; only that option
          supports scheduled server link checks.
        </p>
      </>
    ),
  },
  {
    id: "install",
    number: "07",
    title: "A place on your home screen.",
    body: (
      <>
        <p>
          Use <strong>Settings → Install Nest</strong>, or your browser’s Install app menu. On
          iPhone or iPad, open Nest in Safari and choose <strong>Share → Add to Home Screen</strong>
          .
        </p>
        <p>
          After the first visit, the saved library works offline. This keeps bookmark metadata
          available; it doesn’t download the destination websites. Install and receiving shared
          links depend on your browser.
        </p>
      </>
    ),
  },
  {
    id: "backup",
    number: "08",
    title: "Keep a copy for yourself.",
    body: (
      <>
        <p>
          Open <strong>Settings → Sync & data</strong>, choose a password of at least 12 characters,
          confirm it, and select <strong>Download encrypted backup</strong>. The .nest file keeps
          bookmarks, collections, tags, notes, trash, and preferences; sync credentials stay on the
          original device. Keep the password safe. JSON provides an unencrypted full backup; HTML
          exports active links for other browsers. Untouched samples are excluded.
        </p>
        <p>
          Transfer the backup file to your new device. In Sync & data, choose the file, enter its
          password, select Preview backup, then Restore backup. Restoring merges records and keeps
          newer changes and existing bookmarks. Old Nest JSON exports also restore here. Files up to
          20 MB are supported. Keep occasional backups because browsers can clear local storage.
        </p>
      </>
    ),
  },
];
export default function GuidePage() {
  return (
    <PublicSite active="guide">
      <PageIntro
        eyebrow="A LITTLE GUIDE"
        title="Make yourself at home."
        description="A few small steps. A calmer little corner of the internet."
      />
      <div className="guide-layout">
        <nav className="guide-nav" aria-label="Guide sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              <span>{s.number}</span>
              {s.title}
            </a>
          ))}
        </nav>
        <div className="guide-sections">
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <span className="public-eyebrow">{s.number} / THE LITTLE DETAILS</span>
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}
          <Link href="/" className="public-primary">
            Ready for your first find? <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </PublicSite>
  );
}
