"use client";

// Public storefront: catalog -> cart -> checkout. The order goes to the POS (re-priced and checked there) and the
// buyer sends the composed message to the shop's WhatsApp. Same look and behaviour as the Modern POS apps.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { StoreData } from "@/lib/pos";
import {
  applyBrandColor, cartBase, cartKey, cartPcs, cartTotal, clampCart, doneKey, findProduct, loadBuyer, local, mediaOf,
  normBrand, rp, saveBuyer, session, sheetState, uid, unitPrice, variantOf, variantStock,
  type Buyer, type CartLine, type DoneOrder, type SheetPick, type View,
} from "@/lib/store";
import { Mark } from "./Mark";
import { Cart, type Checkout } from "./store/Cart";
import { Catalog } from "./store/Catalog";
import { Done } from "./store/Done";
import { ProductSheet } from "./store/ProductSheet";
import { Viewer } from "./store/Viewer";

type SheetState = { pick: SheetPick; closing: boolean; key: number };
type ViewerState = { productId: string; variantId?: string; start: number };
type OrderReply = { code?: string; waUrl?: string; total?: number; pcs?: number; tier?: boolean; error?: string };

export function Storefront({ data: initial, api }: { data: StoreData; api: string }) {
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
  // One id per cart: sending again after a dropped connection is recognised instead of doubled.
  const orderId = useRef<string | null>(null);
  const sheetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Latest values for code that runs after an await or from a document listener.
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const buyerRef = useRef(buyer);
  buyerRef.current = buyer;

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
      const r = await fetch(`${api}/api/public/stores/${slug}`, { cache: "no-store" });
      if (r.status === 404) { setClosed(true); return; }
      if (!r.ok) return;
      const next = (await r.json()) as StoreData;
      const clamped = clampCart(next, cartRef.current);
      local.set(cartKey(slug), clamped);
      setData(next);
      setCart(clamped);
      setClosed(false);
    } catch { /* offline: keep what is shown */ }
  }, [api, slug]);

  // Mount: restore the cart, the buyer details and a just-placed order.
  useEffect(() => {
    const saved = local.get<unknown>(cartKey(slug), []);
    const clamped = clampCart(initial, Array.isArray(saved) ? (saved as CartLine[]) : []);
    local.set(cartKey(slug), clamped);
    setCart(clamped);
    setBuyer(loadBuyer());
    const d = session.get<DoneOrder | null>(doneKey(slug), null);
    if (d) { setDone(d); setView("selesai"); }
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
  };
  const pick = (patch: Partial<SheetPick>) => setSheet((s) => (s ? { ...s, pick: { ...s.pick, ...patch } } : s));
  const shown = sheet ? sheetState(data, cart, sheet.pick) : null;

  const addToCart = () => {
    if (!shown || shown.size === undefined) return;
    const { p, v, size, qty } = shown;
    const at = cart.findIndex((c) => c.productId === p.id && c.variantId === v.id && c.size === size);
    saveCart(at >= 0 ? cart.map((c, i) => (i === at ? { ...c, qty: c.qty + qty } : c)) : [...cart, { productId: p.id, variantId: v.id, size, qty }]);
    showToast(`${p.name}${v.name ? " " + v.name : ""} ${size} ×${qty} masuk keranjang`);
    closeSheet();
  };

  const updateBuyer = (patch: Partial<Buyer>) => {
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
        body: JSON.stringify({ id: orderId.current, items: cart, name, phone, address: ship ? address : "", delivery: buyer.delivery, note: buyer.note || "" }),
      });
      reply = (await res.json().catch(() => ({}))) as OrderReply;
    } catch {
      setBusy(false);
      showToast("Tidak ada koneksi internet. Coba lagi.");
      return;
    }
    setBusy(false);
    if (!res.ok) {
      showToast(reply.error || "Pesanan gagal dikirim. Coba lagi.");
      if (res.status === 409) { orderId.current = null; await refresh(); }
      return;
    }
    const placed: DoneOrder = { code: reply.code ?? "", waUrl: reply.waUrl ?? "", total: reply.total ?? 0, pcs: reply.pcs ?? 0, tier: !!reply.tier };
    setDone(placed);
    session.set(doneKey(slug), placed);
    saveCart([]);
    updateBuyer({ note: "" });
    go("selesai");
    // The link on the done view is what the buyer taps if the browser blocks this jump.
    setTimeout(() => { try { window.location.href = placed.waUrl; } catch { /* ignore */ } }, 400);
  };

  const brand = normBrand(data.brand);
  const pcs = cartPcs(cart);

  let content: ReactNode = null;
  if (!ready) content = null;
  else if (closed) content = <section className="panel"><div className="empty"><b>Toko sedang tutup.</b> Coba lagi nanti.</div></section>;
  else if (view === "keranjang") {
    content = (
      <Cart data={data} cart={cart} buyer={buyer} busy={busy} onGo={(v) => { closeSheet(); go(v); }} onClear={() => saveCart([])}
        onQty={(i, qty) => saveCart(qty > 0 ? cart.map((c, j) => (j === i ? { ...c, qty } : c)) : cart.filter((_, j) => j !== i))}
        onBuyer={updateBuyer} onToast={showToast} onPlace={(c) => void placeOrder(c)} />
    );
  } else if (view === "selesai" && done) {
    content = <Done order={done} shop={data.shop} onNew={() => { setDone(null); session.set(doneKey(slug), null); go("katalog"); }} />;
  } else {
    const save = cartBase(data, cart) - cartTotal(data, cart);
    content = (
      <>
        <Catalog data={data} query={query} onQuery={setQuery} onProduct={openProduct} />
        {cart.length ? (
          <div className="cartbar">
            <div>
              <div style={{ fontWeight: 600 }}>{pcs} pcs · {rp(cartTotal(data, cart))}</div>
              <div className="small" style={{ opacity: 0.75 }}>{save > 0 ? `hemat ${rp(save)} harga grosir` : "belum termasuk ongkir"}</div>
            </div>
            <button className="btn" data-act="go" data-id="keranjang" style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--surface)" }}
              onClick={() => { closeSheet(); go("keranjang"); }}>Lihat keranjang</button>
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
        <span id="brand-mark" className="brand-mark">{brand.logo ? <img className="mark logo" src={encodeURI(brand.logo)} alt="" /> : <Mark />}</span>
        <div className="brand"><span id="brand-name">{data.shop || "Modern POS"}</span><small id="shop-sub">Toko online</small></div>
        <div className="sp" />
        <button type="button" className="icon-btn cart-btn" data-act="cart" aria-label="Keranjang" id="cart-btn"
          onClick={() => { closeSheet(); go(view === "keranjang" ? "katalog" : "keranjang"); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></svg>
          {pcs ? <span className="badge">{pcs}</span> : null}
        </button>
      </header>
      <main key={nav} className={ready ? "wrap enter" : "wrap"} id="main" aria-live="polite">{content}</main>
      <div id="sheet-root">
        {sheet && shown ? (
          <ProductSheet key={sheet.key} state={shown} closing={sheet.closing} onClose={closeSheet}
            onVariant={(id) => pick({ variantId: id, size: shown.size, qty: 1 })}
            onSize={(size) => pick({ size, qty: 1 })}
            onQty={(qty) => pick({ size: shown.size, qty })}
            onView={(i) => setViewer({ productId: shown.p.id, variantId: shown.v.id, start: i })}
            onAdd={addToCart} />
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
