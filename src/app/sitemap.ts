import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/brand";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/about", "/guide", "/brand", "/privacy", "/case-study"].map((path) => ({
    url: absoluteUrl(path),
  }));
}
