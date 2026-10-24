"use client";

// Public storefront: catalog -> cart -> checkout. The order goes to the POS (re-priced and checked there) and the
// buyer sends the composed message to the shop's WhatsApp. Laid out like a modern marketplace: search in the header, grid catalog, dialog product page.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Quote, StoreData } from "@/lib/pos";
import {
  applyBrandColor, cartBase, cartKey, codeKey, productPath, REF_DAYS, refKey, cartPcs, cartTotal, clampCart, doneKey, findProduct, loadBuyer, local, mediaOf,
  normBrand, rp, saveBuyer, session, sheetState, uid, unitPrice, variantOf, variantStock,
  type Buyer, type CartLine, type DoneOrder, type Ref, type SheetPick, type View,
} from "@/lib/store";
import { Mark } from "./Mark";
import { Cart, type Checkout } from "./store/Cart";
import { Catalog } from "./store/Catalog";
import { Done } from "./store/Done";
import { ProductSheet } from "./store/ProductSheet";
import { Viewer } from "./store/Viewer";
import { tr } from "@/lib/i18n";
import { LangSwitch } from "@/lib/i18n/LangSwitch";

type SheetState = { pick: SheetPick; closing: boolean; key: number };
type ViewerState = { productId: string; variantId?: string; start: number };
type OrderReply = { code?: string; waUrl?: string; total?: number; pcs?: number; tier?: boolean; promo?: { name: string; amount: number } | null; error?: string };

type Props = {
  data: StoreData; api: string;
  /** Path the store lives under ("" for the home store, "/<slug>" otherwise). */
  base: string;
  /** Product to open first (from a /p/<product> link). */
  initialProduct?: string;
};

export function Storefront({ data: initial, api, base, initialProduct }: Props) {
  const [data, setData] = useState(initial);
  const slug = initial.slug;
  // Browser storage is read after mount, so nothing below the header renders on the server.
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("katalog");
  const [nav, setNav] = useState(0); // bumped on every navigation: replays the enter animation
  const [closed, setClosed] = useState(false);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [buyer, setBuyer] = useState<Buyer>({ name: "", phone: "", address: "", delivery: "pickup", note: "" });
  const [done, setDone] = useState<DoneOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);
  const [ref, setRef] = useState<Ref | null>(null);
  // promo code the buyer applied, and the shop's price for the cart with its promo (typed code or automatic)
  const [code, setCodeState] = useState("");
  const [quoted, setQuote] = useState<(Quote & { forCode: string }) | null>(null);
  // a quote for another code is never shown (its subtotal is checked against the cart too)
  const quote = quoted && quoted.forCode === code ? quoted : null;
  // The store's home path; through a reseller's link it keeps their /r/<code> so shared links still count for them.
  const home = `${base}${ref ? `/r/${ref.code}` : ""}`;
  const homeRef = useRef(home);
  homeRef.current = home;
  // One id per cart: sending again after a dropped connection is recognised instead of doubled.
  const orderId = useRef<string | null>(null);
  const sheetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Latest values for code that runs after an await or from a document listener.
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const buyerRef = useRef(buyer);
  buyerRef.current = buyer;
  const refCode = useRef<string | null>(null);
  refCode.current = ref?.code ?? null;

  const saveCart = useCallback((next: CartLine[]) => {
    orderId.current = null;
    setCart(next);
    local.set(cartKey(slug), next);
  }, [slug]);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const closeSheet = useCallback(() => {
    if (/\/p\/[^/]+$/.test(location.pathname)) history.replaceState(history.state, "", homeRef.current || "/");
    setSheet((s) => (s && !s.closing ? { ...s, closing: true } : s));
    clearTimeout(sheetTimer.current);
    sheetTimer.current = setTimeout(() => setSheet((s) => (s && s.closing ? null : s)), 220);
  }, []);

  const go = useCallback((v: View) => {
    setView(v);
    setClosed(false);
    setNav((n) => n + 1);
  }, []);

  const refresh = useCallback(async () => {
    try {
      // keep the reseller's link: their held stock is part of what this buyer may order
      const q = refCode.current ? `?ref=${encodeURIComponent(refCode.current)}` : "";
      const r = await fetch(`${api}/api/public/stores/${slug}${q}`, { cache: "no-store" });
      if (r.status === 404) { setClosed(true); return; }
      if (!r.ok) return;
      const next = (await r.json()) as StoreData;
      if (refCode.current && !next.ref) {
        // the reseller was removed: stop crediting them
        refCode.current = null;
        local.set(refKey(slug), null);
        setRef(null);
      }
      const clamped = clampCart(next, cartRef.current);
      local.set(cartKey(slug), clamped);
      setData(next);
      setCart(clamped);
      setClosed(false);
    } catch { /* offline: keep what is shown */ }
  }, [api, slug]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Mount: restore the cart, the buyer details and a just-placed order.
  useEffect(() => {
    const saved = local.get<unknown>(cartKey(slug), []);
    const clamped = clampCart(initial, Array.isArray(saved) ? (saved as CartLine[]) : []);
    local.set(cartKey(slug), clamped);
    setCart(clamped);
    setBuyer(loadBuyer());
    setCodeState(session.get<string>(codeKey(slug), "") || "");
    const d = session.get<DoneOrder | null>(doneKey(slug), null);
    if (d) { setDone(d); setView("selesai"); }
    // A reseller's link the POS recognised wins; otherwise the last one opened, if recent enough.
    if (initial.ref) {
      const r = { ...initial.ref, at: Date.now() };
      local.set(refKey(slug), r);
      setRef(r);
    } else if (/\/r\/[^/]+/.test(location.pathname)) {
      // a reseller link the POS no longer knows (removed reseller): forget the old one too
      local.set(refKey(slug), null);
    } else {
      const r = local.get<Ref | null>(refKey(slug), null);
      if (r && r.code && Date.now() - Number(r.at) < REF_DAYS * 86400_000) {
        setRef(r);
        // the page was rendered without it: load the catalog through their link, which also checks it still works
        refCode.current = r.code;
        void refreshRef.current();
      } else if (r) local.set(refKey(slug), null);
    }
    setReady(true);
  }, [initial, slug]);

  useEffect(() => {
    applyBrandColor(normBrand(data.brand).color);
    if (data.shop) document.title = data.shop;
  }, [data.brand, data.shop]);

  useEffect(() => { if (nav) window.scrollTo(0, 0); }, [nav]);

  // Document-level keys and tab focus, read through a ref so the listeners see current state.
  const live = useRef({ viewer, sheet, busy, refresh, closeSheet });
  useEffect(() => { live.current = { viewer, sheet, busy, refresh, closeSheet }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (live.current.viewer) setViewer(null); else live.current.closeSheet();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !live.current.sheet && !live.current.busy) void live.current.refresh();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => () => { clearTimeout(sheetTimer.current); clearTimeout(toastTimer.current); }, []);

  const openProduct = (id: string) => {
    const p = findProduct(data, id);
    if (!p) return;
    clearTimeout(sheetTimer.current);
    const v0 = p.variants.find((v) => variantStock(v) > 0) || p.variants[0];
    setSheet((s) => ({ pick: { productId: id, variantId: v0.id, qty: 1 }, closing: false, key: (s?.key ?? 0) + 1 }));
    // The address bar shows the product's own link, so it can be copied or shared.
    history.replaceState(history.state, "", productPath(homeRef.current, p));
  };
  const shareProduct = async () => {
    if (!shown) return;
    const url = location.origin + productPath(home, shown.p);
    const text = tr("{name} · {price} di {shop}", { name: shown.p.name, price: rp(shown.price), shop: data.shop });
    try {
      if (navigator.share) { await navigator.share({ title: shown.p.name, text, url }); return; }
    } catch (e) { if ((e as Error).name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); showToast(tr("Link produk disalin")); } catch { showToast(url); }
  };

  // A /p/<product> link opens that product once the page is ready.
  const opened = useRef(false);
  useEffect(() => {
    if (!ready || opened.current || !initialProduct) return;
    opened.current = true;
    if (view === "katalog") openProduct(initialProduct);
  });
  const pick = (patch: Partial<SheetPick>) => setSheet((s) => (s ? { ...s, pick: { ...s.pick, ...patch } } : s));
  const shown = sheet ? sheetState(data, cart, sheet.pick) : null;

  const addToCart = () => {
    if (!shown || shown.size === undefined) return;
    const { p, v, size, qty } = shown;
    const at = cart.findIndex((c) => c.productId === p.id && c.variantId === v.id && c.size === size);
    saveCart(at >= 0 ? cart.map((c, i) => (i === at ? { ...c, qty: c.qty + qty } : c)) : [...cart, { productId: p.id, variantId: v.id, size, qty }]);
    showToast(tr("{name}{v} {size} ×{qty} masuk keranjang", { name: p.name, v: v.name ? " " + v.name : "", size, qty }));
    closeSheet();
  };

  const setCode = (c: string) => {
    orderId.current = null;
    setCodeState(c);
    session.set(codeKey(slug), c || null);
  };

  // Ask the shop what the cart costs with its promo whenever the cart, code or phone (once-per-buyer promos) changes.
  const wantsQuote = ready && view === "keranjang" && cart.length > 0 && (!!code || !!data.promos?.length);
  const phoneDigits = buyer.phone.replace(/\D/g, "");
  useEffect(() => {
    if (!wantsQuote) { setQuote(null); return; }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${api}/api/public/stores/${slug}/quote`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: cart, code, phone: phoneDigits, ...(refCode.current ? { ref: refCode.current } : {}) }),
        });
        const j = (await r.json().catch(() => null)) as Quote | null;
        if (live) setQuote(r.ok && j ? { ...j, forCode: code } : null);
      } catch { if (live) setQuote(null); }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [wantsQuote, api, slug, cart, code, phoneDigits]);

  const updateBuyer = (patch: Partial<Buyer>) => {
    // new details make a new order: a resend with the old id would get the old details back
    if (Object.entries(patch).some(([k, v]) => buyerRef.current[k as keyof Buyer] !== v)) orderId.current = null;
    const next = { ...buyerRef.current, ...patch };
    buyerRef.current = next;
    setBuyer(next);
    saveBuyer(next);
  };

  const placeOrder = async ({ name, phone, address }: Checkout) => {
    if (busy || !cart.length) return;
    setBusy(true);
    orderId.current = orderId.current || uid();
    const ship = buyer.delivery === "ship";
    let res: Response;
    let reply: OrderReply = {};
    try {
      res = await fetch(`${api}/api/public/stores/${slug}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: orderId.current, items: cart, name, phone, address: ship ? address : "", delivery: buyer.delivery, note: buyer.note || "", ...(ref ? { ref: ref.code } : {}), ...(code ? { code } : {}) }),
      });
      reply = (await res.json().catch(() => ({}))) as OrderReply;
    } catch {
      setBusy(false);
      showToast(tr("Tidak ada koneksi internet. Coba lagi."));
      return;
    }
    setBusy(false);
    if (!res.ok) {
      showToast(reply.error || tr("Pesanan gagal dikirim. Coba lagi."));
      if (res.status === 409) { orderId.current = null; await refresh(); }
      return;
    }
    const placed: DoneOrder = { code: reply.code ?? "", waUrl: reply.waUrl ?? "", total: reply.total ?? 0, pcs: reply.pcs ?? 0, tier: !!reply.tier, promo: reply.promo ?? null };
    // the shop priced it with its latest prices and promo; say so when that differs from what the cart showed
    const shown = cartTotal(data, cart) - (quote && quote.subtotal === cartTotal(data, cart) && quote.promo ? quote.promo.amount : 0);
    if (reply.total !== undefined && reply.total !== shown) showToast(tr("Harga sudah diperbarui toko. Total pesananmu {total}.", { total: rp(reply.total) }));
    setDone(placed);
    session.set(doneKey(slug), placed);
    saveCart([]);
    updateBuyer({ note: "" });
    setCode("");
    go("selesai");
    // The link on the done view is what the buyer taps if the browser blocks this jump.
    setTimeout(() => { try { window.location.href = placed.waUrl; } catch { /* ignore */ } }, 400);
  };

  const brand = normBrand(data.brand);
  const pcs = cartPcs(cart);

  let content: ReactNode = null;
  if (!ready) content = null;
  else if (closed) content = <div className="empty"><b>{tr("Toko sedang tutup.")}</b> {tr("Coba lagi nanti.")}</div>;
  else if (view === "keranjang") {
    content = (
      <Cart data={data} cart={cart} buyer={buyer} busy={busy} onGo={(v) => { closeSheet(); go(v); }} onClear={() => saveCart([])}
        onQty={(i, qty) => saveCart(qty > 0 ? cart.map((c, j) => (j === i ? { ...c, qty } : c)) : cart.filter((_, j) => j !== i))}
        onBuyer={updateBuyer} onToast={showToast} onPlace={(c) => void placeOrder(c)} code={code} quote={quote} onCode={setCode} />
    );
  } else if (view === "selesai" && done) {
    content = <Done order={done} shop={data.shop} onNew={() => { setDone(null); session.set(doneKey(slug), null); go("katalog"); }} />;
  } else {
    const save = cartBase(data, cart) - cartTotal(data, cart);
    content = (
      <>
        <Catalog data={data} query={query} via={ref?.name} onProduct={openProduct} onClearQuery={() => setQuery("")} />
        {cart.length ? (
          <div className="cartbar">
            <div>
              <div style={{ fontWeight: 700 }}>{pcs} {tr("pcs ·")} {rp(cartTotal(data, cart))}</div>
              <div className="small" style={{ opacity: 0.75 }}>{save > 0 ? tr("hemat {save} harga grosir", { save: rp(save) }) : tr("belum termasuk ongkir")}</div>
            </div>
            <button className="btn" data-act="go" data-id="keranjang" onClick={() => { closeSheet(); go("keranjang"); }}>{tr("Lihat keranjang")}</button>
          </div>
        ) : null}
      </>
    );
  }

  const viewed = viewer ? findProduct(data, viewer.productId) : undefined;
  const viewedVariant = viewed ? variantOf(viewed, viewer?.variantId) : undefined;

  return (
    <>
      <header className="top" id="top">
        <div className="top-in">
          <button type="button" className="brand-link" aria-label={tr("Beranda toko")} onClick={() => { closeSheet(); go("katalog"); }}>
            <span id="brand-mark" className="brand-mark">{brand.logo ? <img className="mark logo" src={encodeURI(brand.logo)} alt="" /> : <Mark />}</span>
            <span className="brand"><span id="brand-name">{data.shop || "Modern POS"}</span><small id="shop-sub">{tr("Toko online")}</small></span>
          </button>
          <label className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
            <span className="sr">{tr("Cari baju")}</span>
            <input type="search" id="cat-q" data-input="q" placeholder={tr("Cari di {v}", { v: data.shop || "toko" })} value={query} enterKeyHint="search"
              onChange={(e) => { setQuery(e.target.value); if (view !== "katalog" && view !== "selesai") go("katalog"); }} />
          </label>
          <div className="top-actions">
            <LangSwitch compact />
            <button type="button" className="icon-btn cart-btn wide" data-act="cart" aria-label={tr("Keranjang")} id="cart-btn"
              onClick={() => { closeSheet(); go(view === "keranjang" ? "katalog" : "keranjang"); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></svg>
              <span className="cart-label">{tr("Keranjang")}</span>
              {pcs ? <span className="badge">{pcs}</span> : null}
            </button>
          </div>
        </div>
      </header>
      <main key={nav} className={[ready ? "wrap enter" : "wrap", view === "katalog" && cart.length ? "has-bar" : ""].join(" ").trim()} id="main" aria-live="polite">{content}</main>
      <div id="sheet-root">
        {sheet && shown ? (
          <ProductSheet key={sheet.key} state={shown} closing={sheet.closing} onClose={closeSheet}
            onVariant={(id) => pick({ variantId: id, size: shown.size, qty: 1 })}
            onSize={(size) => pick({ size, qty: 1 })}
            onQty={(qty) => pick({ size: shown.size, qty })}
            onView={(i) => setViewer({ productId: shown.p.id, variantId: shown.v.id, start: i })}
            onAdd={addToCart} onShare={() => void shareProduct()} />
        ) : null}
      </div>
      <div id="toast-root">{toast ? <div className="toast" role="status" key={toast.key}>{toast.msg}</div> : null}</div>
      <div id="viewer-root">
        {viewer && viewed && mediaOf(viewed, viewedVariant).length ? (
          <Viewer title={viewed.name} caption={`${viewed.name}${viewedVariant?.name ? " · " + viewedVariant.name : ""}`} price={rp(unitPrice(viewed, pcs))}
            media={mediaOf(viewed, viewedVariant)} start={viewer.start} onClose={() => setViewer(null)} />
        ) : null}
      </div>
    </>
  );
}
