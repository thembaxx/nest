import type { MetadataRoute } from "next";
import { absoluteUrl, isPreview, siteUrl } from "@/lib/brand";
export default function robots(): MetadataRoute.Robots {
  if (isPreview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
