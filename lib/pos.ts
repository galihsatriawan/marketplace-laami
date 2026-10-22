
/** Base URL of the Modern POS that holds the shop's data (its public API lives under /api/public). */
export const posUrl = () => (process.env.POS_API_URL || "").trim().replace(/\/+$/, "");
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export interface StoreData {
  slug: string; shop: string; intro: string; whatsapp: string;
  brand: { logo: string; color: string; address: string; instagram: string; website: string };
  sizes: string[];
  /** Categories in use, sorted; older POS versions send none. */
  categories?: string[];
  /** A reseller's link (?ref=code) the POS recognised: whose link the buyer opened. */
  ref?: { code: string; name: string } | null;
  products: { id: string; slug?: string; name: string; category?: string; price: number; tiers: { min: number; price: number }[];
    variants: { id: string; name: string; media: { url: string; type: "image" | "video" }[]; stock: Record<string, number> }[] }[];
}
export type StoreResult = { ok: true; data: StoreData } | { ok: false; status: number };

/** Loads a shop's public catalog from the POS. 404 when the shop is unknown or switched off. */
export async function getStore(slug: string, ref?: string): Promise<StoreResult> {
  const s = String(slug || "").toLowerCase();
  if (!SLUG_RE.test(s)) return { ok: false, status: 404 };
  if (!posUrl()) return { ok: false, status: 503 };
  try {
    const q = ref && /^[a-z0-9-]{1,40}$/i.test(ref) ? `?ref=${encodeURIComponent(ref.toLowerCase())}` : "";
    const r = await fetch(`${posUrl()}/api/public/stores/${s}${q}`, { cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) {
      if (r.status !== 404) console.error("POS answered", r.status, `${posUrl()}/api/public/stores/${s}`);
      return { ok: false, status: r.status === 404 ? 404 : 503 };
    }
    return { ok: true, data: (await r.json()) as StoreData };
  } catch (e) {
    console.error("POS unreachable", posUrl(), e);
    return { ok: false, status: 503 };
  }
}
