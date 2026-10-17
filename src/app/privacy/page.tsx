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
          fallback. Preferences and sync recovery keys, if you enable sync, are saved on this
          device. Google access tokens stay in memory and are not saved in browser storage. The
          sample library is clearly marked; samples aren’t sent to cloud sync or included in
          exports.
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
          Google Drive sync is optional. Nest encrypts bookmark records, collections, notes, and
          deletion history on your device with AES-256-GCM before sending them directly to Google.
          Only the hidden appDataFolder permission is requested; Nest cannot read your other Drive
          files. Google can see account, file-size, timing, and request metadata. Google sign-in
          loads Google’s identity script when you prepare to connect.
        </p>
        <p>
          A random recovery key decrypts your Drive library. Pair another device with the same key
          and Google account. Nest cannot recover a lost key. The local library and key are readable
          to someone with access to your unlocked browser. Reconnect Google after reopening Nest or
          when the short-lived access token expires. Disconnecting stops sync on this device and
          keeps local and Drive copies. Remove Nest’s hidden app data or access through Google
          Drive’s Manage apps settings if you want to remove the cloud copy.
        </p>
        <p>
          Legacy Nest cloud sync remains available for existing users. It sends readable records to
          the deployment’s server and Neon database over HTTPS and is not end-to-end encrypted. Its
          recovery key is a bearer credential; the server uses its hash as a library identifier.
          Switching to Google stops legacy sync on this device and does not erase existing server
          data.
        </p>
        <h2>Checking for broken links.</h2>
        <p>
          If legacy Nest cloud sync and scheduled checks are configured and you leave link checking
          enabled, the server periodically contacts saved URLs. Destination sites can see those
          checks. You can turn checks off in Settings; that preference reaches the server at the
          next successful sync. The server cannot check URLs inside encrypted Google Drive
          libraries.
        </p>
        <h2>Keep a little backup.</h2>
        <p>
          Browser storage can be cleared by you, your browser, or your device. Download a password-
          protected backup to keep bookmarks, collections, notes, trash, and portable preferences.
          Backup encryption uses AES-256-GCM with PBKDF2-SHA256 and 600,000 iterations, a random
          salt, and a fresh nonce. Sync keys and Google sessions are excluded. Keep the file and
          password safe; lost passwords cannot be recovered. JSON and HTML exports are readable by
          anyone who has the files. Restore previews the contents and merges records, keeping newer
          changes. Installing the PWA does not guarantee permanent browser storage.
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
