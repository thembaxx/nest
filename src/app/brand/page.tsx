import { ArrowDownRight, Download } from "lucide-react";
import { PublicSite, PageIntro } from "@/components/public-site";
import { pageMetadata } from "@/lib/brand";
export const metadata = pageMetadata(
  "The Nest identity",
  "Meet the Nest logo: a folded bookmark N, a point of curiosity, and a forest-green squircle. Download the official icons, symbols, and wordmarks.",
  "/brand",
);
const colors = [
  { name: "Forest", hex: "#24452A", className: "swatch-forest" },
  { name: "Chartreuse", hex: "#D5EA70", className: "swatch-lime" },
  { name: "Golden", hex: "#E9BE52", className: "swatch-gold" },
  { name: "Warm ivory", hex: "#F7F6F2", className: "swatch-ivory" },
];
const assets = [
  { name: "Sculpted app icon", format: "PNG · 1254 × 1254", path: "/brand/nest-icon-master.png" },
  { name: "Vector app icon", format: "SVG · Scalable", path: "/brand/nest-icon-vector.svg" },
  { name: "Nest symbol", format: "SVG · Forest / transparent", path: "/brand/nest-symbol.svg" },
  {
    name: "Light symbol",
    format: "SVG · Ivory / transparent",
    path: "/brand/nest-symbol-light.svg",
  },
  {
    name: "Primary wordmark",
    format: "SVG · Forest / transparent",
    path: "/brand/nest-wordmark.svg",
  },
  {
    name: "Light wordmark",
    format: "SVG · Ivory / transparent",
    path: "/brand/nest-wordmark-light.svg",
  },
  { name: "Social preview", format: "PNG · 1200 × 630", path: "/brand/nest-social.png" },
  { name: "Brand sheet", format: "SVG · 1440 × 1000", path: "/brand/nest-brand-sheet.svg" },
];
export default function BrandPage() {
  return (
    <PublicSite active="brand">
      <PageIntro
        eyebrow="THE NEST IDENTITY"
        title="An idea, tucked in."
        description="A folded bookmark. A little point of curiosity. A mark that feels just as at home on your home screen as it does beside a good find."
      />
      <section className="brand-hero">
        <div className="brand-hero-icon">
          <img
            src="/brand/nest-app-icon-512.webp"
            width="320"
            height="320"
            className="brand-app-icon"
            alt="Nest app icon: a dimensional chartreuse and golden N with an ivory dot on a forest-green squircle"
          />
          <span>GOOD THINGS, KEPT CLOSE.</span>
        </div>
        <div className="brand-story">
          <span className="public-eyebrow">SMALL SHAPE. A LITTLE STORY.</span>
          <h2>
            A home for
            <br />
            <em>the next good thing.</em>
          </h2>
          <p>
            The ribbon folds into an N and curls back into itself, like a bookmark keeping your
            place. The small ivory dot is a point of curiosity: one more idea worth bringing home.
          </p>
          <p>
            Forest green gives it a quiet foundation. Chartreuse and gold bring a little light. A
            sculpted squircle makes it feel familiar on a home screen, while a simple vector mark
            keeps it clear at small sizes.
          </p>
          <a href="/brand/nest-brand-kit.zip" className="public-primary" download>
            Download the brand kit <Download size={16} />
          </a>
        </div>
      </section>
      <section className="brand-variants" aria-label="Nest logo variants">
        <figure className="variant-light">
          <img src="/brand/nest-wordmark.svg" width="258" height="72" alt="Nest primary wordmark" />
          <figcaption>01 / THE SIGNATURE</figcaption>
        </figure>
        <figure className="variant-dark">
          <img
            src="/brand/nest-symbol-light.svg"
            width="100"
            height="100"
            alt="Ivory Nest symbol"
          />
          <figcaption>02 / A QUIETER MARK</figcaption>
        </figure>
        <figure className="variant-gold">
          <img
            src="/brand/nest-symbol.svg"
            width="100"
            height="100"
            alt="Forest-green Nest symbol"
          />
          <figcaption>03 / SMALL & CLEAR</figcaption>
        </figure>
      </section>
      <section className="brand-palette">
        <div className="public-section-heading">
          <span className="public-eyebrow">A LITTLE COLOR, KEPT SIMPLE</span>
          <h2>
            Grounded.
            <br />
            <em>With a glimmer.</em>
          </h2>
        </div>
        <div className="palette-swatches">
          {colors.map((c) => (
            <article key={c.name}>
              <div className={c.className} />
              <span>{c.name}</span>
              <code>{c.hex}</code>
            </article>
          ))}
        </div>
      </section>
      <section className="brand-type">
        <div>
          <span className="public-eyebrow">THE WORDS AROUND THE MARK</span>
          <h2>
            Room to breathe.
            <br />
            <em>Something to say.</em>
          </h2>
          <p>
            Instrument Serif gives the big ideas a little character. DM Sans keeps the everyday
            details clear and comfortable.
          </p>
        </div>
        <div className="type-specimens">
          <div>
            <span>INSTRUMENT SERIF / THE BIG IDEAS</span>
            <p>
              Follow your
              <br />
              <em>curiosity.</em>
            </p>
          </div>
          <div>
            <span>DM SANS / THE LITTLE DETAILS</span>
            <p>
              A link. A rabbit hole. A someday.
              <br />
              Good things, kept close.
            </p>
            <small>Aa Bb Cc Dd Ee Ff Gg 0123456789</small>
          </div>
        </div>
      </section>
      <section className="brand-downloads">
        <div className="public-section-heading">
          <span className="public-eyebrow">READY FOR A LITTLE USE</span>
          <h2>Take a piece of Nest.</h2>
          <p>
            Original assets, with a simple mark for small spaces and a sculpted icon for bigger
            moments.
          </p>
        </div>
        <div className="asset-downloads">
          {assets.map((a) => (
            <a key={a.path} href={a.path} download>
              <span>
                <strong>{a.name}</strong>
                <small>{a.format}</small>
              </span>
              <ArrowDownRight size={21} />
            </a>
          ))}
        </div>
      </section>
      <section className="brand-usage">
        <h2>A few little courtesies.</h2>
        <p>
          Give the mark breathing room of at least one dot’s width. Use the simplified symbol below
          32 pixels. Keep the ribbon and dot together, preserve their proportions, and use the light
          wordmark on dark backgrounds. Keep the sculpted icon’s colors intact.
        </p>
        <p>
          Our voice is warm, brief, and useful. A little curious; never noisy. Say what something
          does, help people keep moving, and let their finds be the interesting part.
        </p>
      </section>
    </PublicSite>
  );
}
