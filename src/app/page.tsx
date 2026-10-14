import { LibraryProvider } from "@/components/library-provider";
import { NestApp } from "@/components/nest-app";
import { absoluteUrl, brand, jsonLd, siteUrl } from "@/lib/brand";
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: brand.name,
      url: siteUrl,
      description: brand.description,
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      "@id": absoluteUrl("/#app"),
      name: brand.name,
      url: siteUrl,
      description: brand.description,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      browserRequirements: "JavaScript and browser storage. Optional local AI requires WebGPU.",
      image: absoluteUrl(brand.socialImage),
      softwareVersion: "1.0.0",
      featureList: [
        "Browser bookmark import",
        "Duplicate detection",
        "Custom collections",
        "Offline bookmark search",
        "Optional on-device AI",
        "Optional cloud sync",
      ],
      subjectOf: { "@type": "SoftwareSourceCode", codeRepository: brand.repository },
    },
  ],
};
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <LibraryProvider>
        <NestApp />
      </LibraryProvider>
      <noscript>
        <section className="no-script-message">
          <h1>Nest — A smarter home for your bookmarks</h1>
          <p>
            Save links, import browser bookmarks, skip duplicates, and organize your ideas. The
            bookmark library needs JavaScript and browser storage.
          </p>
          <a href="/about">Discover Nest</a>
          <a href="/guide">Read the getting started guide</a>
        </section>
      </noscript>
    </>
  );
}
