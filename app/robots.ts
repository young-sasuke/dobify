import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://<your-domain>/sitemap.xml", // TODO: replace with deployed domain
  }
}

