import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getStore, posUrl, type StoreData, type StoreResult } from "@/lib/pos";
import { Storefront } from "./Storefront";
import { Unavailable } from "./Unavailable";
import { tr } from "@/lib/i18n";
import { serverLang } from "@/lib/i18n/server";
import { siteOrigin } from "@/lib/site";

/** Which store a URL shows: an explicit slug, or the home store (DEFAULT_STORE) when none is given. */
export type ShopRoute = { slug?: string; ref?: string; product?: string };

const defaultStore = () => (process.env.DEFAULT_STORE || "").trim().toLowerCase();
const slugOf = (r: ShopRoute) => (r.slug ?? defaultStore()).toLowerCase();
/** Path the store lives under: "" for the home store, "/<slug>" otherwise. */
const baseOf = (slug: string) => (slug && slug === defaultStore() ? "" : `/${slug}`);
// One POS request per page view, shared by the metadata and the page.
const fetchStore = cache((slug: string, ref: string) => getStore(slug, ref || undefined));
const load = async (r: ShopRoute): Promise<StoreResult> =>
  slugOf(r) ? fetchStore(slugOf(r), r.ref || "") : { ok: false, status: 404 };
/** A product by its link slug, or by id for older links. */
export const findBySlug = (d: StoreData, key?: string) =>
  key ? d.products.find((p) => p.slug === key || p.id === key) : undefined;

/** The browser-tab icon: the shop's logo from the POS brand settings, else the default mark. */
const shopIcons = (d: StoreData): Metadata["icons"] => {
  const logo = d.brand?.logo ? encodeURI(d.brand.logo) : "";
  return logo ? { icon: [{ url: logo }], apple: [{ url: logo }] } : { icon: "/icon.svg" };
};

/** Canonical URL of a store page or one of its products. Reseller links (/r/<code>) point at the shop's own URL,
 *  so search engines index one page per product. */
const canonicalOf = (origin: string, slug: string, p?: StoreData["products"][number]) =>
  `${origin}${baseOf(slug)}${p ? `/p/${encodeURIComponent(p.slug || p.id)}` : ""}`.replace(/^(https?:\/\/[^/]+)$/, "$1/");
const imagesOf = (p: StoreData["products"][number]) => [...new Set(p.variants.flatMap((v) => v.media).filter((m) => m.type === "image").map((m) => m.url))];
const soldOut = (p: StoreData["products"][number]) => p.soldOut ?? p.variants.every((v) => Object.values(v.stock).every((n) => !(Number(n) > 0)));

/** schema.org data for search engines: the store with an ItemList of its products, or one Product with its offer.
 *  Only facts from the POS; no ratings or reviews (the shop collects none). */
function jsonLd(d: StoreData, origin: string, slug: string, product?: StoreData["products"][number]) {
  const shopUrl = canonicalOf(origin, slug);
  const store = { "@type": "Store", "@id": `${shopUrl}#store`, name: d.shop, url: shopUrl,
    ...(d.intro ? { description: d.intro } : {}), ...(d.brand?.logo ? { logo: d.brand.logo, image: d.brand.logo } : {}),
    ...(d.whatsapp ? { telephone: `+${d.whatsapp.replace(/\D/g, "").replace(/^0/, "62")}` } : {}),
    ...(d.brand?.address ? { address: { "@type": "PostalAddress", streetAddress: d.brand.address, addressCountry: "ID" } } : {}),
    sameAs: [d.brand?.instagram ? `https://instagram.com/${d.brand.instagram.replace(/^@/, "")}` : "", d.brand?.shopee ? `https://${d.brand.shopee}` : "", d.brand?.tiktok ? `https://${d.brand.tiktok}` : ""].filter(Boolean) };
  if (product) {
    const url = canonicalOf(origin, slug, product);
    const imgs = imagesOf(product);
    return { "@context": "https://schema.org", "@type": "Product", name: product.name, url, sku: product.id,
      ...(imgs.length ? { image: imgs } : {}), ...(product.descriptionText ? { description: product.descriptionText } : {}),
      ...(product.category ? { category: product.subcategory ? `${product.category} > ${product.subcategory}` : product.category } : {}),
      brand: { "@type": "Brand", name: d.shop },
      offers: { "@type": "Offer", url, priceCurrency: "IDR", price: product.price, itemCondition: "https://schema.org/NewCondition",
        availability: soldOut(product) ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", seller: { "@id": `${shopUrl}#store` } } };
  }
  return { "@context": "https://schema.org", "@graph": [store, { "@type": "ItemList", name: d.shop, itemListElement: d.products.map((p, i) => ({
    "@type": "ListItem", position: i + 1, url: canonicalOf(origin, slug, p), name: p.name })) }] };
}
/** JSON for a <script> tag: "<" escaped so a product name can never close the tag. */
const ldJson = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

const rpText = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

export async function shopMetadata(route: ShopRoute): Promise<Metadata> {
  await serverLang();
  const r = await load(route);
  if (!r.ok) return { title: r.status === 404 ? tr("Toko tidak ditemukan") : tr("Toko sedang tidak bisa dibuka"), robots: { index: false } };
  const d = r.data;
  const p = findBySlug(d, route.product);
  const origin = await siteOrigin();
  const slug = slugOf(route);
  if (p) {
    const img = p.variants.flatMap((v) => v.media).find((m) => m.type === "image")?.url;
    const tier = p.tiers[0];
    const url = canonicalOf(origin, slug, p);
    const description = p.descriptionText ? `${rpText(p.price)} · ${p.descriptionText}` : tr("{price}{tier}. Pesan langsung lewat WhatsApp di {shop}.", { price: rpText(p.price), tier: tier ? tr(" · beli {min}+ pcs {price}/pcs", { min: tier.min, price: rpText(tier.price) }) : "", shop: d.shop });
    const title = `${p.name} · ${d.shop}`;
    return { title, description, icons: shopIcons(d), alternates: { canonical: url },
      openGraph: { title, description, url, siteName: d.shop, type: "website", images: img ? [{ url: img }] : undefined }, twitter: { card: img ? "summary_large_image" : "summary" } };
  }
  const description = d.intro || tr("Belanja di {shop}. Pesan langsung lewat WhatsApp.", { shop: d.shop });
  const url = canonicalOf(origin, slug);
  return { title: d.shop, description, icons: shopIcons(d), alternates: { canonical: url },
    openGraph: { title: d.shop, description, url, siteName: d.shop, type: "website", images: d.brand.logo ? [{ url: d.brand.logo }] : undefined } };
}

/** One shop's storefront. An unknown shop, product or reseller link is a 404 (see the not-found pages); a POS that
 *  cannot be reached shows the "unavailable" card (proxy.ts already turns that into a 503 in the usual case). */
export async function ShopPage({ route }: { route: ShopRoute }) {
  await serverLang();
  const r = await load(route);
  if (!r.ok) {
    if (r.status === 404) notFound();
    return <Unavailable />;
  }
  if (route.product && !findBySlug(r.data, route.product)) notFound();
  if (route.ref && !r.data.ref) notFound();
  const slug = slugOf(route);
  const product = findBySlug(r.data, route.product);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd(r.data, await siteOrigin(), slug, product)) }} />
      <Storefront data={r.data} api={posUrl()} base={baseOf(slug)} initialProduct={product?.id} />
    </>
  );
}
