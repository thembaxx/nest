import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nest — Smart Bookmark Manager",
    short_name: "Nest",
    description: "Good things, kept close. A calmer home for your bookmarks.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f6f2",
    theme_color: "#f7f6f2",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Save a bookmark",
        short_name: "Save",
        url: "/?action=add",
        icons: [{ src: "/icons/icon-192.png?v=2", sizes: "192x192" }],
      },
    ],
    share_target: {
      action: "/",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
