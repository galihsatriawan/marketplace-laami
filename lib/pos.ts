
/** Base URL of the Modern POS that holds the shop's data (its public API lives under /api/public). */
export const posUrl = () => (process.env.POS_API_URL || "").trim().replace(/\/+$/, "");
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export interface StoreData {
  slug: string; shop: string; intro: string; whatsapp: string;
  brand: { logo: string; color: string; address: string; instagram: string; website: string;
    /** Shop links on Shopee / TikTok Shop without "https://"; older POS versions send none. */
    shopee?: string; tiktok?: string };
  sizes: string[];
  /** Categories in use, sorted; older POS versions send none. */
  categories?: string[];
  /** Sub-categories per category, e.g. { Gamis: ["Anak", "Syari"] }; older POS versions send none. */
  subcategories?: Record<string, string[]>;
  /** A reseller's link (?ref=code) the POS recognised: whose link the buyer opened. */
  ref?: { code: string; name: string } | null;
  /** Automatic promos running today (codes are never listed); older POS versions send none. */
  promos?: PublicPromo[];
  /** Catalog shape the POS sent (2 when asked with ?v=2); older POS versions send none. */
  v?: number;
  /** v2: sold-out products and 0-stock sizes are listed (shown crossed out, never orderable). */
  showSoldOut?: boolean;
  /** How buyers pay the shop (bank accounts, e-wallets, QRIS image, note); null or absent when the shop set none. */
  payment?: StorePayment | null;
  /** The shop's own "Cara belanja" / "Cara retur / tukar" steps; empty `order` = the built-in steps, empty `returns` = none. */
  steps?: StoreSteps;
  /** How shipping is priced: "rajaongkir" = live courier rates at checkout; "manual" = the shop tells the cost on WhatsApp. */
  shipping?: StoreShipping;
  products: { id: string; slug?: string; name: string; category?: string; subcategory?: string; price: number;
    /** v2 badges: arrived recently (or marked new), among the shop's bestsellers (rank 1 = top), nothing left. */
    isNew?: boolean; bestseller?: boolean; bestsellerRank?: number; soldOut?: boolean;
    /** v2: plain-text summary of the description (at most 160 chars), for meta tags and structured data. */
    descriptionText?: string;
    /** Struck-through price ("harga coret") shown next to `price`; display only, buyers pay `price`. Only sent when higher. */
    strike?: number; tiers: { min: number; price: number }[];
    /** Product description as HTML the POS already sanitized (p br strong b em i ul ol li h3 a); "" or absent when none. */
    description?: string;
    /** v2: grams per pcs for the shipping weight; absent = the storefront assumes DEFAULT_WEIGHT_G. */
    weight?: number;
    /** Ongkir subsidy for this product in Rp per pcs (0 = none); absent = the shop's default `shipping.subsidy.perPcs`. */
    shipSubsidy?: number;
    variants: { id: string; name: string; media: { url: string; type: "image" | "video" }[]; stock: Record<string, number> }[] }[];
}
/** The shop's payment methods as the public catalog lists them; account numbers are the shop's own, published on purpose. */
export interface StorePayment {
  banks: { bank: string; number: string; holder: string }[];
  wallets: { wallet: string; number: string; holder: string }[];
  /** Absolute link to the QRIS image. */
  qris?: string;
  note: string;
}
export interface Step { title: string; text: string }
export interface StoreSteps { order: Step[]; returns: Step[]; returnNote: string }
/** A free-shipping area ("Gratis ongkir area Sumberpucung"); minSpend 0 = any order. */
export interface FreeArea { name: string; minSpend: number }
/** How much of the shop's daily RajaOngkir allowance is left: "out" = no live ongkir today (the shop tells it on WhatsApp). */
export type ShipQuota = "ok" | "low" | "out";
export interface StoreShipping { provider: "manual" | "rajaongkir"; freeAreas: FreeArea[]; badge: boolean;
  /** Older POS versions send none (= "ok"). */
  quota?: ShipQuota;
  /** "Subsidi ongkir": the shop takes Rp per pcs off the courier cost; null / absent = none (or an older POS). */
  subsidy?: ShipSubsidy | null }
/** Shipping discount per pcs (perPcs = the default rate; products carry their own resolved `shipSubsidy`).
 *  maxPerOrder 0 = no cap; minPcs: pcs in the order before it applies; resellerLinks: also on reseller (?ref) links. */
export interface ShipSubsidy { perPcs: number; maxPerOrder: number; minPcs: number; resellerLinks: boolean }
/** A place a parcel can go, from the shop's destination search. free: inside one of the shop's free-shipping areas. */
export interface Destination { id: number | string; label: string; district?: string; city?: string; province?: string; zip?: string; free?: boolean }
/** One courier service with its price for this cart. */
export interface ShipOption { courier: string; courierName: string; service: string; description: string; cost: number; etd: string;
  /** Newer POS with a subsidy: what the buyer pays for this option (cost − subsidy). */
  pay?: number }
/** The shop's shipping price for a cart to one destination. free: the order ships free (minSpend met). */
export interface ShipQuote { weight: number; free: boolean; freeArea?: string; minSpendLeft?: number; options: ShipOption[];
  /** Newer POS: the parcel weight it priced (whole kg), the allowance left, and whether the price came from its cache. */
  weightKg?: number; quota?: ShipQuota; cached?: boolean;
  /** Newer POS: the most the subsidy takes off for this cart (each option's discount is min(subsidy, cost)). */
  subsidy?: number;
  /** Storefront only: the subsidy this cart had (worked out locally) when the price was asked; the shop's figures above
   *  count only while the cart still has that subsidy (qty changes inside the same kg reuse the price without asking). */
  askedSub?: number }
/** Shipping as the shop priced it on a placed order. */
export interface OrderShipping { destinationLabel: string; courier: string; courierName?: string; service: string; etd?: string; cost: number; free?: boolean; freeArea?: string;
  /** Newer POS: the subsidy taken off `cost`, and what the buyer pays (in the order total). */
  subsidy?: number; pay?: number }
/** An automatic promo as the POS lists it: "some" = only some products or categories. */
export interface PublicPromo {
  name: string; type: "percent" | "amount"; value: number; maxOff: number; minSpend: number; minPcs: number; end: string;
  scope: "all" | "some"; withWholesale: boolean; oncePerBuyer: boolean;
}
/** The POS's price for a cart with its promo (a typed code, else the best automatic one). `error`: why a code does not work. */
export interface Quote { pcs: number; subtotal: number; total: number; tier: boolean; promo: { id: string; name: string; code?: string; amount: number } | null; error?: string;
  /** The reason as a template + values, for tr(). */ errorTpl?: string; errorVars?: Record<string, string | number> }
export type StoreResult = { ok: true; data: StoreData } | { ok: false; status: number };

/** How long a server render waits for the POS before showing "shop unavailable" (503). */
export const POS_TIMEOUT_MS = 8000;

/** Query string for the public catalog: always the v2 shape (badges, sold-out products), plus a valid reseller code. */
export const storeQuery = (ref?: string | null) =>
  `?v=2${ref && /^[a-z0-9-]{1,40}$/i.test(ref) ? `&ref=${encodeURIComponent(ref.toLowerCase())}` : ""}`;

/** Loads a shop's public catalog from the POS. 404 when the shop is unknown or switched off; 503 when the POS
 *  is unset, answers with an error, or does not answer within POS_TIMEOUT_MS. */
export async function getStore(slug: string, ref?: string): Promise<StoreResult> {
  const s = String(slug || "").toLowerCase();
  if (!SLUG_RE.test(s)) return { ok: false, status: 404 };
  if (!posUrl()) return { ok: false, status: 503 };
  try {
    const r = await fetch(`${posUrl()}/api/public/stores/${s}${storeQuery(ref)}`, { cache: "no-store", headers: { accept: "application/json" }, signal: AbortSignal.timeout(POS_TIMEOUT_MS) });
    if (!r.ok) {
      if (r.status !== 404) console.error("POS answered", r.status, `${posUrl()}/api/public/stores/${s}`);
      return { ok: false, status: r.status === 404 ? 404 : 503 };
    }
    return { ok: true, data: (await r.json()) as StoreData };
  } catch (e) {
    console.error((e as Error)?.name === "TimeoutError" ? `POS did not answer within ${POS_TIMEOUT_MS} ms` : "POS unreachable", posUrl(), e);
    return { ok: false, status: 503 };
  }
}
