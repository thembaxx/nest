/** The public production origin stays stable across preview deployments. */
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://nest-iota-three.vercel.app";
const origin = new URL(configuredOrigin);
if (!["https:", "http:"].includes(origin.protocol))
  throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin.");
export const siteUrl = origin.origin;
export const brand = {
  name: "Nest",
  tagline: "Good things, kept close.",
  title: "Nest — Smart Bookmark Manager with Optional Local AI",
  description:
    "Save links, import browser bookmarks, skip duplicates, and organize ideas in a calmer bookmark manager. Works offline, with optional private, on-device AI.",
  repository: "https://github.com/thembaxx/nest",
  socialImage: "/brand/nest-social.png",
};
export const absoluteUrl = (path: string = "/") => new URL(path, siteUrl).href;
export const isPreview = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
export function pageMetadata(title: string, description: string, path: string) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} · Nest`,
      description,
      url: absoluteUrl(path),
      type: "website" as const,
      images: [
        {
          url: absoluteUrl(brand.socialImage),
          width: 1200,
          height: 630,
          alt: "Nest — Good things, kept close. A smarter home for your bookmarks.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${title} · Nest`,
      description,
      images: [absoluteUrl(brand.socialImage)],
    },
  };
}
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
export const faqs = [
  {
    question: "Can I import bookmarks from another browser?",
    answer:
      "Yes. Export an HTML bookmark file from Chrome, Safari, Firefox, Edge, or Brave, then import it into Nest. Browser folders become collections, matching folder names are reused, and duplicate links are filed without creating duplicate bookmarks. Nest, Chrome, and Firefox JSON imports are also supported.",
  },
  {
    question: "Does Nest work offline?",
    answer:
      "Your bookmark library is saved on your device and remains searchable offline after the app has loaded. Destination websites are not downloaded for offline reading. Installing Nest adds a home-screen app experience on supported browsers.",
  },
  {
    question: "Do I have to download an AI model?",
    answer:
      "No. Saving, importing, topic suggestions, keyword search, filtering, and collections work without a model. Local AI is optional and is downloaded only when you choose it in Settings.",
  },
  {
    question: "Where does the AI run?",
    answer:
      "Local AI runs in your browser through WebGPU. It requires a compatible browser and enough device memory. Model files need an initial download. Your bookmark content is not sent to a hosted AI model. Up to 24 relevant bookmarks are considered per request, and changes are previewed before you apply them.",
  },
  {
    question: "How does syncing work?",
    answer:
      "Optional Google Drive sync encrypts your library on your device. Pair devices with the same Google account and recovery key, and reconnect Google when its session expires. Password-protected local backups also restore on other devices. Legacy Nest cloud sync requires a Neon database and is not end-to-end encrypted. Lost keys and backup passwords cannot be recovered.",
  },
  {
    question: "How does Nest identify broken links?",
    answer:
      "When legacy Nest cloud sync and scheduled checks are configured, Nest checks saved links in daily batches. Two missing-page responses, such as 404 or 410, confirm a broken link. Temporary blocks and timeouts are treated as uncertain, and a healthy response restores a confirmed link.",
  },
];
