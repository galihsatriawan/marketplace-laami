
/** Base URL of the Modern POS that holds the shop's data (its public API lives under /api/public). */
export const posUrl = () => (process.env.POS_API_URL || "").trim().replace(/\/+$/, "");
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export interface StoreData {
  slug: string; shop: string; intro: string; whatsapp: string;
  brand: { logo: string; color: string; address: string; instagram: string; website: string };
  sizes: string[];
  /** Categories in use, sorted; older POS versions send none. */
  categories?: string[];
  /** Sub-categories per category, e.g. { Gamis: ["Anak", "Syari"] }; older POS versions send none. */
  subcategories?: Record<string, string[]>;
  /** A reseller's link (?ref=code) the POS recognised: whose link the buyer opened. */
  ref?: { code: string; name: string } | null;
  /** Automatic promos running today (codes are never listed); older POS versions send none. */
  promos?: PublicPromo[];
  products: { id: string; slug?: string; name: string; category?: string; subcategory?: string; price: number; tiers: { min: number; price: number }[];
    variants: { id: string; name: string; media: { url: string; type: "image" | "video" }[]; stock: Record<string, number> }[] }[];
}
/** An automatic promo as the POS lists it: "some" = only some products or categories. */
export interface PublicPromo {
  name: string; type: "percent" | "amount"; value: number; maxOff: number; minSpend: number; minPcs: number; end: string;
  scope: "all" | "some"; withWholesale: boolean; oncePerBuyer: boolean;
}
/** The POS's price for a cart with its promo (a typed code, else the best automatic one). `error`: why a code does not work. */
export interface Quote { pcs: number; subtotal: number; total: number; tier: boolean; promo: { id: string; name: string; code?: string; amount: number } | null; error?: string;
  /** The reason as a template + values, for tr(). */ errorTpl?: string; errorVars?: Record<string, string | number> }
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
