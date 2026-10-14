# Nest identity

Nest is a quiet home for bookmarks, ideas, and things to come back to.

The primary line is **Good things, kept close.** The supporting line is **A little home for your curious mind.** Product descriptions should name the task plainly: **a smart bookmark manager with optional local AI**.

The original mark is a folded bookmark ribbon shaped into an N, with one separate point of curiosity. The icon direction takes dimensional materials, strong silhouettes, and squircle framing from the user-provided collection of app icons. The image is an inspiration reference; no icon in that collection is reproduced.

## The system

- **Sculpted icon:** chartreuse and gold ribbon, ivory dot, forest-green squircle. Use for home screens, app discovery, launch, social previews, and larger identity moments.
- **Vector icon:** a simplified gradient version for tiny favicons and maskable contexts.
- **Simple symbol:** one-color N and dot for small UI moments, monochrome applications, and places where the full tile would add noise.
- **Wordmark:** lowercase `nest` with a golden point. SVG letterforms are outlined from the DM Sans type used by the interface, so the exported file doesn't depend on an installed font.

Palette: Forest `#24452A`, Chartreuse `#D5EA70`, Golden `#E9BE52`, Warm ivory `#F7F6F2`.

Typography: Instrument Serif for expressive headlines; DM Sans for navigation, controls, and everyday reading. Both type families are already self-hosted in the application. No third-party font request is needed at runtime.

Give the symbol at least one dot's width of clear space. Below 32 pixels, use the simple symbol or the vector favicon. Preserve the relative placement of the ribbon and dot. Don't stretch, recolor, or add extra effects to the sculpted icon. Use the light symbol/wordmark on dark surfaces.

## Voice

Warm, curious, brief, and useful. Prefer a concrete action over clever wording when someone needs to make a decision. Use short lines and familiar words. Small moments can have personality; important data and recovery information should stay direct.

Good: “Save bookmark,” “Bring your bookmarks home,” “Your device copy is still here.”

Avoid exaggerated promises about privacy, automatic organization, model accuracy, or cloud availability. Core functionality works without a model. Cloud sync needs configured storage. Natural-language changes are previewed. Local AI uses bounded retrieval and compatible WebGPU hardware.

## Exports

The public brand page is `/brand`. The complete download is `/brand/nest-brand-kit.zip`.

- `nest-icon-master.png`: original sculpted app icon.
- `nest-icon-vector.svg`: simplified gradient icon.
- `nest-symbol.svg` / `nest-symbol-light.svg`: transparent vector symbols.
- `nest-wordmark.svg` / `nest-wordmark-light.svg`: outlined vector signatures.
- `nest-social.png` / `nest-social.svg`: 1200 × 630 social card.
- `nest-brand-sheet.png` / `nest-brand-sheet.svg`: 1440 × 1000 identity sheet.
- PWA icons, maskable icon, Apple touch icon, and multi-size ICO are in `/icons`.

Run `pnpm brand:assets` to regenerate derivatives from the master artwork, vector sources, and committed type outlines. It does not call an image generator and requires only the project's Node dependencies. The generated image is the raster master; SVG variants intentionally simplify it for smaller contexts.
