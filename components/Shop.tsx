import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getStore, posUrl, type StoreData, type StoreResult } from "@/lib/pos";
import { Mark } from "./Mark";
import { Storefront } from "./Storefront";
import { tr } from "@/lib/i18n";
import { serverLang } from "@/lib/i18n/server";

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

const rpText = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

export async function shopMetadata(route: ShopRoute): Promise<Metadata> {
  await serverLang();
  const r = await load(route);
  if (!r.ok) return { title: tr("Toko tidak ditemukan") };
  const d = r.data;
  const p = findBySlug(d, route.product);
  if (p) {
    const img = p.variants.flatMap((v) => v.media).find((m) => m.type === "image")?.url;
    const tier = p.tiers[0];
    const description = tr("{price}{tier}. Pesan langsung lewat WhatsApp di {shop}.", { price: rpText(p.price), tier: tier ? tr(" · beli {min}+ pcs {price}/pcs", { min: tier.min, price: rpText(tier.price) }) : "", shop: d.shop });
    const title = `${p.name} · ${d.shop}`;
    return { title, description, openGraph: { title, description, siteName: d.shop, type: "website", images: img ? [{ url: img }] : undefined }, twitter: { card: img ? "summary_large_image" : "summary" } };
  }
  const description = d.intro || tr("Belanja di {shop}. Pesan langsung lewat WhatsApp.", { shop: d.shop });
  return { title: d.shop, description, openGraph: { title: d.shop, description, siteName: d.shop, type: "website", images: d.brand.logo ? [{ url: d.brand.logo }] : undefined } };
}

/** One shop's storefront, or a friendly message when it cannot be opened. */
export async function ShopPage({ route }: { route: ShopRoute }) {
  await serverLang();
  const r = await load(route);
  if (!r.ok) {
    // A product or reseller path under an unknown store is a plain 404; the store's own page explains itself.
    if (route.slug && (route.product || route.ref) && r.status === 404) notFound();
    return (
      <main className="wrap state">
        <section className="panel" style={{ maxWidth: 420, width: "100%" }}>
          <div className="panel-b" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <Mark />
            <h1 style={{ fontSize: 22 }}>{r.status === 404 ? tr("Toko tidak ditemukan") : tr("Toko sedang tidak bisa dibuka")}</h1>
            <p className="muted" style={{ margin: 0 }}>{r.status === 404 ? tr("Cek lagi link tokonya, atau mungkin tokonya sedang tutup.") : tr("Coba muat ulang sebentar lagi.")}</p>
          </div>
        </section>
      </main>
    );
  }
  const slug = slugOf(route);
  return <Storefront data={r.data} api={posUrl()} base={baseOf(slug)} initialProduct={findBySlug(r.data, route.product)?.id} />;
}
