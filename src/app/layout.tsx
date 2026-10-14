import type { Metadata, Viewport } from "next";
import { absoluteUrl, brand, isPreview, siteUrl } from "@/lib/brand";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: brand.title, template: "%s · Nest" },
  description: brand.description,
  applicationName: brand.name,
  category: "productivity",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: brand.name },
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icons/icon.svg?v=2", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png?v=2", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  robots: {
    index: !isPreview,
    follow: !isPreview,
    googleBot: {
      index: !isPreview,
      follow: !isPreview,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: brand.title,
    description: brand.description,
    url: siteUrl,
    siteName: brand.name,
    locale: "en_US",
    type: "website",
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
    card: "summary_large_image",
    title: brand.title,
    description: brand.description,
    images: [absoluteUrl(brand.socialImage)],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1b211d" },
  ],
  colorScheme: "light dark",
};
const themeScript = `try{var s=JSON.parse(localStorage.getItem('nest-settings')||'{}');var d=s.theme==='dark'||(s.theme!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=d?'#1b211d':'#f7f6f2'})}catch(e){}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link
          rel="alternate"
          type="text/plain"
          href="/llms.txt"
          title="Nest documentation for language models"
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
