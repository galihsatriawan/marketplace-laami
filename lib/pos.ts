
/** Base URL of the Modern POS that holds the shop's data (its public API lives under /api/public). */
export const posUrl = () => (process.env.POS_API_URL || "").trim().replace(/\/+$/, "");
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export interface StoreData {
  slug: string; shop: string; intro: string; whatsapp: string;
  brand: { logo: string; color: string; address: string; instagram: string; website: string };
  sizes: string[];
  products: { id: string; name: string; price: number; tiers: { min: number; price: number }[];
    variants: { id: string; name: string; media: { url: string; type: "image" | "video" }[]; stock: Record<string, number> }[] }[];
}
export type StoreResult = { ok: true; data: StoreData } | { ok: false; status: number };

/** Loads a shop's public catalog from the POS. 404 when the shop is unknown or switched off. */
export async function getStore(slug: string): Promise<StoreResult> {
  const s = String(slug || "").toLowerCase();
  if (!SLUG_RE.test(s)) return { ok: false, status: 404 };
  if (!posUrl()) return { ok: false, status: 503 };
  try {
    const r = await fetch(`${posUrl()}/api/public/stores/${s}`, { cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) return { ok: false, status: r.status === 404 ? 404 : 503 };
    return { ok: true, data: (await r.json()) as StoreData };
  } catch {
    return { ok: false, status: 503 };
  }
}
