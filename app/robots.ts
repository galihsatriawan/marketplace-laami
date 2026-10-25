import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Everything public may be crawled except the setup check; the sitemap lists the home store's products. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/shop-unavailable"] }], sitemap: `${origin}/sitemap.xml`, host: origin };
}
