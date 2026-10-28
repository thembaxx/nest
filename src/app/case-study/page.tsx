import Link from "next/link";
import { PublicSite, PageIntro } from "@/components/public-site";
import { pageMetadata } from "@/lib/brand";

export const metadata = pageMetadata(
  "Building a library you can leave and return to",
  "Nest case study: an offline-first bookmark library, deliberate sample data, recoverable storage errors, and portable backups.",
  "/case-study",
);

export default function CaseStudyPage() {
  return (
    <PublicSite active="case-study">
      <PageIntro
        eyebrow="A PRODUCT & ENGINEERING CASE STUDY"
        title="Good finds deserve a way back."
        description="An independent bookmark manager built around one complete journey: bring links in, make them useful, find them again, and take a copy with you."
      />
      <article className="public-prose">
        <h2>The problem</h2>
        <p>
          Browser folders accumulate links without the notes, context, and flexible grouping that
          make them useful later. A personal library also needs an exit: its value should survive a
          different browser or a lost device.
        </p>
        <h2>The product decisions</h2>
        <p>
          Nest imports exported bookmark files with a preview, reuses matching folders, and detects
          tracking variants of a link. Collections, tags, notes, favorites, and keyword search work
          without an account or a model download. The editorial layout and pastel collections keep
          the library approachable. Samples are clearly marked; importing can remove them, while
          edited samples become personal records.
        </p>
        <h2>The reliability decisions</h2>
        <p>
          IndexedDB stores the library, with a localStorage fallback. A read failure stops loading
          instead of replacing saved data with samples. Failed saves show a persistent recovery
          notice. JSON and password-encrypted backups preserve metadata, collections, trash, and
          safe preferences; restore validates a file before merging it. HTML export serves browser
          bookmark tools. Optional Google Drive sync encrypts snapshots on the device.
        </p>
        <h2>Tradeoffs and limits</h2>
        <p>
          Device-first storage avoids mandatory accounts, but browser data can be cleared or
          evicted: backups remain necessary. Timestamp-based merging keeps newer records and relies
          on reasonably accurate device clocks. Offline access covers saved bookmark details, not
          the destination pages. Live Google consent, Raindrop authorization, and local GPU
          inference depend on external configuration or hardware. Legacy server sync is separate and
          is not end-to-end encrypted.
        </p>
        <h2>Evidence, not adoption claims</h2>
        <p>
          This is an implemented independent project, with automated unit and browser checks. No
          user research, customer adoption, or business outcomes are claimed. The{" "}
          <a
            href="https://github.com/thembaxx/nest/blob/main/docs/launch-readiness.md"
            target="_blank"
            rel="noreferrer"
          >
            release evidence
          </a>{" "}
          records the commands, observed journeys, and service limits. The{" "}
          <a href="https://github.com/thembaxx/nest" target="_blank" rel="noreferrer">
            public source
          </a>{" "}
          contains the implementation and test cases.
        </p>
        <p>
          <Link href="/guide">Follow the guide</Link> ·{" "}
          <Link href="/privacy">Privacy & storage</Link> ·{" "}
          <a href="https://github.com/thembaxx/nest/issues" target="_blank" rel="noreferrer">
            Get help or report a bug
          </a>
        </p>
        <Link className="public-primary" href="/">
          Try Nest
        </Link>
      </article>
    </PublicSite>
  );
}
