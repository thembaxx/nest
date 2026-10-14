import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nest — Good things, kept close.",
  description:
    "A calmer home for your bookmarks. Save links, collect ideas, and find the things that spark your curiosity. Offline first, with optional private AI.",
  applicationName: "Nest",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Nest" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Nest — Good things, kept close.",
    description: "A little home for your curious mind.",
    type: "website",
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
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to library
        </a>
        {children}
      </body>
    </html>
  );
}
