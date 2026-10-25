// Storefront logic shared by the browser components: types, money formatting, wholesale pricing, storage.
import type { OrderShipping, PublicPromo, StoreData } from "./pos";
import { tr } from "@/lib/i18n";

export type Product = StoreData["products"][number];
export type Variant = Product["variants"][number];
export type Media = Variant["media"][number];
export type Brand = StoreData["brand"];

/** produk: a product on its own page (a /p/<product> link opened directly). */
export type View = "katalog" | "keranjang" | "selesai" | "produk";
export type Delivery = "pickup" | "ship";

export interface CartLine { productId: string; variantId: string; size: string; qty: number }
export interface Buyer { name: string; phone: string; address: string; delivery: Delivery; note: string }
/** The last placed order, kept for this browser tab so the "done" view survives the jump to WhatsApp. */
export interface DoneOrder { code: string; waUrl: string; total: number; pcs: number; tier: boolean; promo?: { name: string; amount: number } | null;
  /** When it was placed (ms) and the store path it was placed on: the done view only comes back there, and not for long. */
  at?: number; home?: string;
  /** What was ordered as the shop priced it, and the total before the promo (newer POS versions send them). */
  items?: { name: string; variant: string; size: string; qty: number; price: number }[]; subtotal?: number;
  /** The composed WhatsApp text, for copying when WhatsApp does not open. */
  message?: string;
  /** Courier, service and cost when the shop priced the shipping (RajaOngkir); absent = the shop tells the cost. */
  shipping?: OrderShipping | null }
/** How long a placed order's done view comes back after a reload (e.g. returning from WhatsApp). */
export const DONE_TTL_MS = 30 * 60_000;
/** Catalog browsing choices, kept while the buyer visits the cart so "Lanjut belanja" returns to the same list. */
export type Sort = "rec" | "low" | "high" | "name";
export interface Browse { filter: string; sort: Sort; cat: string; sub: string }
export const BROWSE0: Browse = { filter: "all", sort: "rec", cat: "", sub: "" };
/** Browser-side request timeouts (ms): catalog refresh and price quote, and placing an order. */
export const FETCH_TIMEOUT_MS = 10_000;
export const ORDER_TIMEOUT_MS = 20_000;
/** Product sheet selection. size is the buyer's pick; the sheet falls back to an in-stock size. */
export interface SheetPick { productId: string; variantId: string; size?: string; qty: number }

export const cartKey = (slug: string) => `toko.cart.${slug}`;
/** The reseller whose link the buyer last opened, kept REF_DAYS so a later visit still counts for them. */
export const refKey = (slug: string) => `toko.ref.${slug}`;
export const REF_DAYS = 30;
export interface Ref { code: string; name: string; at: number }
export const doneKey = (slug: string) => `toko.done.${slug}`;
/** The promo code typed in the cart, kept for this browser tab. */
export const codeKey = (slug: string) => `toko.code.${slug}`;
export const BUYER_KEY = "toko.buyer";

export const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sign = (n: number) => (n < 0 ? "−" : "");
const digits = (n: number) => Math.abs(n).toLocaleString("id-ID");
export const rp = (v: unknown): string => { const n = Math.round(num(v)); return `${sign(n)}Rp${digits(n)}`; };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

/* storage: JSON values, failures ignored (private mode, quota) */
function read<T>(store: () => Storage, key: string, fallback: T): T {
  try { const v = store().getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(store: () => Storage, key: string, value: unknown) {
  try { if (value == null) store().removeItem(key); else store().setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
export const local = { get: <T,>(k: string, d: T) => read(() => localStorage, k, d), set: (k: string, v: unknown) => write(() => localStorage, k, v) };
export const session = { get: <T,>(k: string, d: T) => read(() => sessionStorage, k, d), set: (k: string, v: unknown) => write(() => sessionStorage, k, v) };

/** Older versions stored the delivery choice in Indonesian ("ambil" / "kirim"). */
export const toDelivery = (v: unknown): Delivery => (v === "ship" || v === "kirim" ? "ship" : "pickup");

export function loadBuyer(): Buyer {
  const s = local.get<Record<string, unknown>>(BUYER_KEY, {});
  const o = s && typeof s === "object" ? s : {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { name: str(o.name), phone: str(o.phone), address: str(o.address), delivery: toDelivery(o.delivery), note: "" };
}
/** The note is for one order only and is not remembered. */
export const saveBuyer = (b: Buyer) => local.set(BUYER_KEY, { name: b.name, phone: b.phone, address: b.address, delivery: b.delivery });

const HEX = /^#[0-9a-f]{6}$/i;
export const normBrand = (b: unknown): Brand => ({
  logo: "", color: "", address: "", instagram: "", website: "", shopee: "", tiktok: "",
  ...(b && typeof b === "object" ? (b as Partial<Brand>) : {}),
});
/** Brand colour as the accent on <html>, like the Modern POS apps. */
export function applyBrandColor(color: string) {
  const root = document.documentElement;
  if (HEX.test(color)) { root.style.setProperty("--brand", color); root.classList.add("branded"); }
  else { root.style.removeProperty("--brand"); root.classList.remove("branded"); }
}

/* catalog */
export const findProduct = (d: StoreData, id: string) => d.products.find((p) => p.id === id);
/** Path of a product page under the store's home path (which may carry a reseller's /r/<code>). */
export const productPath = (home: string, p: Product) => `${home}/p/${p.slug || p.id}`;
export const variantOf = (p: Product | undefined, vid?: string | null): Variant | undefined =>
  p ? (vid ? p.variants.find((v) => v.id === vid) : p.variants[0]) : undefined;
export const hasVariants = (p: Product) => p.variants.length > 1 || !!p.variants[0]?.name;
export const tiersOf = (p: Product) => p.tiers ?? [];
export function sizeEntries(d: StoreData, stock: Record<string, number> | undefined): [string, number][] {
  const order = d.sizes || [];
  const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? 999 : i; };
  return Object.entries(stock || {}).sort((a, b) => rank(a[0]) - rank(b[0]));
}
export const variantStock = (v: Variant) => Object.values(v.stock).reduce((a, b) => a + num(b), 0);
export const variantCover = (v: Variant | undefined) => v?.media.find((m) => m.type === "image")?.url;
export function cover(p: Product): string | undefined {
  for (const v of p.variants) { const c = variantCover(v); if (c) return c; }
  return undefined;
}
export const mediaOf = (p: Product, v: Variant | undefined): Media[] => (v && v.media.length ? v.media : p.variants.flatMap((x) => x.media));
export const tierHint = (p: Product) => { const t = tiersOf(p)[0]; return t ? tr("Beli {min}+ {price}/pcs", { min: t.min, price: rp(t.price) }) : ""; };

/* wholesale: the highest tier whose min <= the TOTAL pcs in the cart (models may be mixed), per product */
export const cartPcs = (cart: CartLine[]) => cart.reduce((a, c) => a + c.qty, 0);
export function unitPrice(p: Product, pcs: number) {
  let best: { min: number; price: number } | null = null;
  for (const t of tiersOf(p)) if (pcs >= t.min) best = t;
  return best ? best.price : p.price;
}
/**
 * The price shown crossed out next to a unit price: the shop's struck-through price when it is higher, else the
 * normal price when a wholesale tier made it lower. 0 = nothing to cross out.
 */
export function wasPrice(p: Product, unit: number) {
  if (num(p.strike) > unit) return num(p.strike);
  return unit < p.price ? p.price : 0;
}
/** "-20%" for a product with a struck-through price (rounded down, so it never claims more than it saves). */
export const strikePct = (p: Product) => (num(p.strike) > p.price ? Math.floor(((num(p.strike) - p.price) / num(p.strike)) * 100) : 0);
export function cartTotal(d: StoreData, cart: CartLine[]) {
  const pcs = cartPcs(cart);
  return cart.reduce((a, c) => { const p = findProduct(d, c.productId); return a + (p ? unitPrice(p, pcs) * c.qty : 0); }, 0);
}
export const cartBase = (d: StoreData, cart: CartLine[]) =>
  cart.reduce((a, c) => { const p = findProduct(d, c.productId); return a + (p ? p.price * c.qty : 0); }, 0);
/** The next wholesale step any product in the cart could reach. */
export function nextTier(d: StoreData, cart: CartLine[]) {
  const pcs = cartPcs(cart);
  let best: { min: number; price: number; name: string } | null = null;
  for (const c of cart) {
    const p = findProduct(d, c.productId);
    if (!p) continue;
    for (const t of tiersOf(p)) if (t.min > pcs && t.price < unitPrice(p, pcs) && (!best || t.min < best.min)) best = { ...t, name: p.name };
  }
  return best;
}
/** Drops lines whose product or variant is gone and caps quantities at the current stock. */
export function clampCart(d: StoreData, cart: CartLine[]): CartLine[] {
  const out: CartLine[] = [];
  for (const c of cart) {
    const v = variantOf(findProduct(d, c.productId), c.variantId);
    if (!v) continue;
    const qty = Math.min(c.qty, num(v.stock[c.size]));
    if (qty > 0) out.push({ ...c, variantId: v.id, qty });
  }
  return out;
}

/** Everything the product sheet shows for the current pick, with size and qty corrected to the stock. */
export function sheetState(d: StoreData, cart: CartLine[], pick: SheetPick) {
  const p = findProduct(d, pick.productId);
  if (!p) return null;
  const v = variantOf(p, pick.variantId) || p.variants[0];
  const sizes = sizeEntries(d, v.stock);
  let size = pick.size;
  if (size === undefined || !(size in v.stock) || num(v.stock[size]) <= 0) size = (sizes.find(([, n]) => num(n) > 0) || sizes[0])?.[0];
  const have = size === undefined ? 0 : num(v.stock[size]);
  const inCart = cart.filter((c) => c.productId === p.id && c.variantId === v.id && c.size === size).reduce((a, c) => a + c.qty, 0);
  const max = Math.max(0, have - inCart);
  const qty = pick.qty > max ? Math.max(1, max) : pick.qty;
  const price = unitPrice(p, cartPcs(cart) + qty);
  return { p, v, sizes, size, have, inCart, max, qty, price, media: mediaOf(p, v) };
}

/* promos */
const shortDate = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return y ? new Date(y, m - 1, dd).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : ""; };
/** Headline of a promo card, e.g. "Diskon 10%" or "Potongan Rp20.000". */
export const promoTitle = (p: PublicPromo) => (p.type === "percent" ? tr("Diskon {v}%", { v: p.value }) : tr("Potongan {rp}", { rp: rp(p.value) }));
/** The fine print: cap, minimums, scope, end date. */
export function promoTerms(p: PublicPromo) {
  return [
    p.type === "percent" && p.maxOff ? tr("maks. {rp}", { rp: rp(p.maxOff) }) : "",
    p.minSpend ? tr("min. belanja {rp}", { rp: rp(p.minSpend) }) : "",
    p.minPcs ? tr("min. {n} pcs", { n: p.minPcs }) : "",
    p.scope === "some" ? tr("produk tertentu") : "",
    !p.withWholesale ? tr("tidak untuk harga grosir") : "",
    p.oncePerBuyer ? tr("1× per pembeli") : "",
    p.end ? tr("s/d {date}", { date: shortDate(p.end) }) : "",
  ].filter(Boolean).join(" · ");
}
