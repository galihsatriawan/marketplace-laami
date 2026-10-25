import type { MetadataRoute } from "next";
import { getStore } from "@/lib/pos";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The home store (DEFAULT_STORE) and each of its products, from the POS public catalog. Only the home page
 *  when the POS cannot be reached, so a crawler never gets an error here. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const slug = (process.env.DEFAULT_STORE || "").trim().toLowerCase();
  const out: MetadataRoute.Sitemap = [{ url: `${origin}/`, changeFrequency: "daily", priority: 1 }];
  if (!slug) return out;
  const r = await getStore(slug);
  if (!r.ok) return out;
  for (const p of r.data.products) out.push({ url: `${origin}/p/${encodeURIComponent(p.slug || p.id)}`, changeFrequency: "daily", priority: 0.8 });
  return out;
}
