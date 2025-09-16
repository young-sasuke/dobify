import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://<your-domain>/", changeFrequency: "weekly", priority: 1 }, // TODO: replace with deployed domain
    { url: "https://<your-domain>/profile" },
    { url: "https://<your-domain>/order-history" },
    { url: "https://<your-domain>/cart" },
  ]
}

