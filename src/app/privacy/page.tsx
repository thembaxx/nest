import { PublicSite, PageIntro } from "@/components/public-site";
import { pageMetadata } from "@/lib/brand";
export const metadata = pageMetadata(
  "Your library, your business",
  "How Nest stores bookmarks on your device, handles optional cloud sync, fetches page metadata, and runs optional local AI.",
  "/privacy",
);
export default function PrivacyPage() {
  return (
    <PublicSite>
      <PageIntro
        eyebrow="PRIVACY & STORAGE"
        title="Your library, your business."
        description="A plain-language look at what stays with you and what optional features send to the server."
      />
      <article className="public-prose">
        <h2>At home on your device.</h2>
        <p>
          Nest saves your bookmark library in IndexedDB in your browser, with a localStorage
          fallback. Preferences and a sync recovery key, if you enable sync, are saved on this
          device. The sample library is clearly marked; samples aren’t sent to cloud sync or
          included in exports.
        </p>
        <h2>When you save a link.</h2>
        <p>
          Adding a link can send its URL to the Nest server to fetch a title and description. The
          server contacts that destination website. The destination can see the server’s request,
          and the hosting provider may retain operational logs. A failed metadata request doesn’t
          stop a valid link from being saved.
        </p>
        <h2>A companion that stays with you.</h2>
        <p>
          Optional local AI runs in your browser using WebGPU. Bookmark content is processed on the
          device and isn’t sent to a hosted AI model. Downloading a model contacts external model
          and runtime hosts, which can see the download request. Model assets are cached in browser
          storage and can be removed in Settings.
        </p>
        <h2>Sync, when you choose it.</h2>
        <p>
          Cloud sync is optional and needs a connected Neon database. It sends bookmark records and
          collections to the deployment’s server and database over HTTPS. Sync data is not
          end-to-end encrypted.
        </p>
        <p>
          A random recovery key grants access to a synced library. The server uses its hash as the
          library identifier. Keep the key safe; anyone who has it can access the library, and a
          lost key cannot be recovered. Disconnecting a device stops its sync but doesn’t erase its
          local copy or the existing cloud copy.
        </p>
        <h2>Checking for broken links.</h2>
        <p>
          If cloud sync and scheduled checks are configured and you leave link checking enabled, the
          server periodically contacts saved URLs. Destination sites can see those checks. You can
          turn checks off in Settings; that preference reaches the server at the next successful
          sync.
        </p>
        <h2>Keep a little backup.</h2>
        <p>
          Browser storage can be cleared by you, your browser, or your device. Export JSON to keep a
          portable copy of active bookmarks and collections. Installing the PWA or downloading a
          model doesn’t guarantee that browser storage will be permanent.
        </p>
        <h2>About public pages.</h2>
        <p>
          The public About, Guide, and Brand pages describe Nest. They do not contain your personal
          bookmark library, notes, or recovery key. Sitemap and LLM documentation include public
          pages only. The application source is available on GitHub so you can inspect its behavior.
        </p>
      </article>
    </PublicSite>
  );
}
