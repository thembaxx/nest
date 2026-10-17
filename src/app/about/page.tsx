import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  FolderSimple as FolderHeart,
  FileArrowDown as Import,
  MagnifyingGlass as Search,
  Sparkle as Sparkles,
  WifiSlash as WifiOff,
} from "@phosphor-icons/react/ssr";
import { PublicSite } from "@/components/public-site";
import { absoluteUrl, brand, faqs, jsonLd, pageMetadata } from "@/lib/brand";
export const metadata = pageMetadata(
  "A smarter home for your bookmarks",
  "Meet Nest: a bookmark manager for saving links, importing browser bookmarks, organizing collections, and finding ideas again. Offline first, with optional local AI.",
  "/about",
);
const features = [
  {
    icon: Bookmark,
    name: "A link. A rabbit hole. A someday.",
    text: "Paste one link or an entire conversation. Nest finds each URL and gives it a little place of its own.",
  },
  {
    icon: Import,
    name: "Bring your history with you.",
    text: "Import browser bookmarks in a few moments. Folders become collections, and duplicate links quietly sit this one out.",
  },
  {
    icon: FolderHeart,
    name: "Your kind of organized.",
    text: "Editable topic suggestions, personal collections, tags, favorites, and notes. Enough structure to find your flow.",
  },
  {
    icon: Search,
    name: "Follow the thought.",
    text: "Search the details you remember, filter by topic, or sort through your library. The good stuff is closer than you think.",
  },
  {
    icon: WifiOff,
    name: "At home, even offline.",
    text: "Your saved library lives on this device first. Install Nest and keep finding your links when the internet takes a break.",
  },
  {
    icon: Sparkles,
    name: "A clever little companion.",
    text: "Choose an optional local AI model for natural-language finding and instructions. Private to your device, with a preview before changes.",
  },
];
export default function AboutPage() {
  return (
    <PublicSite active="about">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "@id": absoluteUrl("/about#questions"),
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }),
        }}
      />
      <section className="public-hero">
        <div>
          <span className="public-eyebrow">
            <span /> A LITTLE HOME FOR YOUR CURIOUS MIND
          </span>
          <h1>
            Good things,
            <br />
            <em>kept close.</em>
          </h1>
          <p>
            A smart bookmark manager for the links, ideas, and rabbit holes you want to come back
            to.
          </p>
          <div className="public-hero-actions">
            <Link className="public-primary" href="/">
              Make yourself at home <ArrowUpRight size={17} />
            </Link>
            <Link className="public-secondary" href="/guide">
              Take a little look around <ArrowUpRight size={15} />
            </Link>
          </div>
          <span className="public-fine-print">
            Offline first <i /> Optional local AI <i /> No account needed
          </span>
        </div>
        <div
          className="identity-scene"
          aria-label="Nest app icon: a folded golden N and ivory dot on a forest green tile"
        >
          <div className="scene-halo" />
          <div className="scene-note note-one">
            <span>Saved for a rainy day</span>
            <small>A little less lost. A little more found.</small>
          </div>
          <img
            className="scene-icon brand-app-icon"
            src="/brand/nest-app-icon-512.webp"
            alt=""
            width="264"
            height="264"
            fetchPriority="high"
          />
          <div className="scene-note note-two">
            <span>Just one more rabbit hole.</span>
            <small>Tucked away, naturally.</small>
            <Bookmark size={19} />
          </div>
          <span className="scene-caption">
            The things that spark something.
            <br />
            All in one little Nest.
          </span>
        </div>
      </section>
      <section className="public-principle">
        <span className="public-eyebrow">LESS TENDING. MORE DISCOVERING.</span>
        <h2>
          Your curiosity doesn’t need
          <br />
          another thing to manage.
        </h2>
        <p>
          Save what catches your eye. Nest handles a little of the sorting, skips duplicates, and
          gives every good find somewhere to belong. Keep it simple, or make it your own.
        </p>
      </section>
      <section className="public-features" aria-label="What you can do with Nest">
        {features.map(({ icon: Icon, name, text }, i) => (
          <article key={name}>
            <span className={`feature-icon feature-${i}`}>
              <Icon size={22} weight="regular" />
            </span>
            <h3>{name}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <section className="public-local-note">
        <div>
          <span className="public-eyebrow">YOUR LIBRARY. YOUR PACE.</span>
          <h2>
            Start small.
            <br />
            Feel right at home.
          </h2>
        </div>
        <div>
          <p>
            Core bookmarking works without an AI download or a cloud account. Your library stays on
            your device first. Keep a portable JSON backup, add Google Drive or recovery-key sync
            when configured, or download a local model when your browser supports it.
          </p>
          <Link href="/privacy">
            See how your data is handled <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>
      <section id="questions" className="public-faq">
        <div>
          <span className="public-eyebrow">A FEW LITTLE ANSWERS</span>
          <h2>
            Curious about
            <br />
            <em>the details?</em>
          </h2>
        </div>
        <div>
          {faqs.map((f) => (
            <details key={f.question}>
              <summary>
                {f.question}
                <span>+</span>
              </summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="public-closing">
        <img
          src="/brand/nest-app-icon-128.webp"
          alt=""
          width="56"
          height="56"
          className="brand-app-icon"
        />
        <h2>A little space for something good.</h2>
        <p>Your next favorite find deserves a home.</p>
        <Link className="public-primary" href="/">
          Open your Nest <ArrowUpRight size={17} />
        </Link>
        <span className="sr-only">{brand.name} smart bookmark manager</span>
      </section>
    </PublicSite>
  );
}
