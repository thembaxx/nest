import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import "./public-site.css";
export function PublicSite({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <div className="public-layout">
      <header className="public-header">
        <Link href="/about" className="public-wordmark" aria-label="Nest — about">
          <img
            src="/brand/nest-app-icon-128.webp"
            width="42"
            height="42"
            alt=""
            className="brand-app-icon"
          />
          <span>
            nest<span>.</span>
          </span>
        </Link>
        <nav aria-label="About Nest">
          <Link href="/about" aria-current={active === "about" ? "page" : undefined}>
            The idea
          </Link>
          <Link href="/guide" aria-current={active === "guide" ? "page" : undefined}>
            The guide
          </Link>
          <Link href="/brand" aria-current={active === "brand" ? "page" : undefined}>
            Brand assets
          </Link>
        </nav>
        <Link href="/" className="public-open">
          Open Nest <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="main-content">{children}</main>
      <footer className="public-footer">
        <div>
          <span className="public-footer-name">
            nest<span>.</span>
          </span>
          <p>A little home for your curious mind.</p>
        </div>
        <nav aria-label="Nest resources">
          <Link href="/guide">Getting started</Link>
          <Link href="/privacy">Privacy & storage</Link>
          <Link href="/brand">Brand assets</Link>
          <a href="/llms.txt">llms.txt</a>
          <a href="https://github.com/thembaxx/nest" target="_blank" rel="noreferrer">
            Source code <ArrowUpRight size={12} />
          </a>
        </nav>
        <span>Good things, kept close.</span>
      </footer>
    </div>
  );
}
export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="public-page-intro">
      <span className="public-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
