import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import type { Destination, Quote, ShipQuote, StoreData } from "@/lib/pos";
import { tr } from "@/lib/i18n";
import { rpShort } from "./ProductSheet";
import { fmtEtd, optCost, ShipBox, type ShipPick } from "./Shipping";
import { areaNames, freeAreas, Truck } from "./Steps";
import {
  cartBase, cartPcs, cartTotal, cover, findProduct, nextTier, normBrand, num, rp, unitPrice, variantCover, wasPrice, variantOf,
  type Buyer, type CartLine, type Delivery, type View,
} from "@/lib/store";

export type Checkout = { name: string; phone: string; address: string };
type Field = "name" | "phone" | "address" | "dest" | "courier";
type Errors = Partial<Record<Field, string>>;
/** What is wrong with the checkout form, field by field (empty when it can be sent). */
export function checkoutErrors(b: Buyer, ship?: ShipCtx): Errors {
  const e: Errors = {};
  if (ship?.live && b.delivery === "ship") {
    if (!ship.dest) e.dest = tr("Pilih kecamatan / kelurahan tujuan");
    else if (ship.quote && ship.quote.options.length && !ship.option) e.courier = tr("Pilih kurir pengiriman");
  }
  if (!b.name.trim()) e.name = tr("Isi nama kamu dulu");
  if (b.phone.replace(/\D/g, "").length < 9) e.phone = b.phone.trim() ? tr("Nomor WhatsApp belum benar. Contoh: 0812 3456 7890") : tr("Isi nomor WhatsApp yang aktif");
  if (b.delivery === "ship" && b.address.trim().length < 10) e.address = tr("Isi alamat lengkap untuk pengiriman");
  return e;
}
/** Props for an input with an inline error under it. */
const errProps = (errs: Errors, f: Field) => (errs[f] ? { "aria-invalid": true as const, "aria-describedby": `co-${f}-err` } : {});
const ErrMsg = ({ errs, f }: { errs: Errors; f: Field }) => (errs[f] ? <span className="f-err" id={`co-${f}-err`} role="alert">{errs[f]}</span> : null);
/** Live shipping prices at checkout (the shop uses RajaOngkir). live: on and working; down: why it fell back. */
export type ShipCtx = {
  live: boolean; down: string; api: string; slug: string;
  dest: Destination | null; onDest: (d: Destination | null) => void;
  quote: ShipQuote | null; loading: boolean;
  pick: ShipPick | null; onPick: (p: ShipPick) => void; onDown: (msg: string) => void;
  /** The picked option in the current quote (null when none / stale). */
  option: ShipQuote["options"][number] | null;
};
/** What the buyer pays for shipping right now; null = not known (the shop tells it). */
export const shipCost = (s: ShipCtx | undefined, delivery: Delivery) =>
  s?.live && delivery === "ship" && s.quote && s.option ? optCost(s.quote, s.option) : null;
type Props = {
  ship?: ShipCtx;
  data: StoreData; cart: CartLine[]; buyer: Buyer; busy: boolean;
  onGo: (v: View) => void; onQty: (index: number, qty: number) => void; onClear: () => void;
  onBuyer: (patch: Partial<Buyer>) => void; onToast: (msg: string) => void; onPlace: (c: Checkout) => void;
  /** Promo code applied ("" = none), the shop's quote for this cart (null while unknown), and setting the code. */
  code: string; quote: Quote | null; onCode: (code: string) => void;
};

const Back = ({ onGo }: { onGo: (v: View) => void }) => (
  <button className="back" data-act="go" data-id="katalog" onClick={() => onGo("katalog")}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>{tr("Lanjut belanja")}
  </button>
);

export function Cart({ data, cart, buyer, busy, onGo, onQty, onClear, onBuyer, onToast, onPlace, code, quote, onCode, ship: sc }: Props) {
  const [typed, setTyped] = useState(code);
  // the promo code field stays folded behind "Punya kode promo?" until the buyer wants it
  const [promoOpen, setPromoOpen] = useState(!!code);
  const [errs, setErrs] = useState<Errors>({});
  const codeRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  // the phone bar's button is shown while the form's own button is off screen
  const [formBtnSeen, setFormBtnSeen] = useState(false);
  const calcRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // hidden while the totals or the form's own button are on screen (it would cover them)
    const els: HTMLElement[] = [];
    if (calcRef.current) els.push(calcRef.current);
    if (submitRef.current) els.push(submitRef.current);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((es) => { es.forEach((e) => seen.set(e.target, e.isIntersecting)); setFormBtnSeen([...seen.values()].some(Boolean)); }, { rootMargin: "0px 0px -60px 0px" });
    els.forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, [cart.length]);
  // the promo line lights up when a discount appears or changes
  const [flash, setFlash] = useState(0);
  const lastOff = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addrRef = useRef<HTMLTextAreaElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const optsRef = useRef<HTMLDivElement>(null);
  // a destination or courier picked clears its error
  useEffect(() => { setErrs((e) => (e.dest && sc?.dest ? { ...e, dest: undefined } : e)); }, [sc?.dest]);
  useEffect(() => { setErrs((e) => (e.courier && sc?.option ? { ...e, courier: undefined } : e)); }, [sc?.option]);

  if (!cart.length) {
    return (
      <>
        <Back onGo={onGo} />
        <div className="title-row"><div><h1>{tr("Keranjang")}</h1></div></div>
        <div className="empty"><b>{tr("Keranjang kosong.")}</b> {tr("Pilih baju di")} <button className="link" data-act="go" data-id="katalog" onClick={() => onGo("katalog")}>{tr("katalog")}</button>.</div>
      </>
    );
  }
  const pcs = cartPcs(cart);
  const total = cartTotal(data, cart);
  const base = cartBase(data, cart);
  const save = base - total;
  const next = nextTier(data, cart);
  // the shop's promo counts only while its quote is for these very prices
  const fresh = !!quote && quote.subtotal === total;
  const promo = fresh ? quote!.promo : null;
  const ship = buyer.delivery === "ship";
  const ongkir = shipCost(sc, buyer.delivery);
  const pay = total - (promo?.amount || 0) + (ongkir || 0);
  const off = promo?.amount || 0;
  useEffect(() => {
    if (off && off !== lastOff.current) setFlash((n) => n + 1);
    lastOff.current = off;
  }, [off]);
  const applyCode = () => { const c = typed.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); setTyped(c); onCode(c); };
  /** Updates a field and clears its error once it is fixed. */
  const edit = (patch: Partial<Buyer>) => {
    onBuyer(patch);
    const f = Object.keys(patch)[0] as Field;
    if (errs[f]) {
      const next = checkoutErrors({ ...buyer, ...patch }, sc);
      setErrs((e) => ({ ...e, [f]: next[f] }));
    }
  };
  const pickupAt = normBrand(data.brand).address;

  const setDelivery = (d: Delivery) => {
    // Render the address box first so it can take the focus.
    flushSync(() => { onBuyer({ delivery: d }); if (d === "pickup") setErrs((e) => ({ ...e, address: undefined })); });
    if (d === "ship") addrRef.current?.focus();
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const name = buyer.name.trim(), phone = buyer.phone.replace(/[^\d+]/g, ""), address = buyer.address.trim();
    const e2 = checkoutErrors(buyer, sc);
    setErrs(e2);
    const first = (["name", "phone", "dest", "address", "courier"] as Field[]).find((f) => e2[f]);
    if (first) {
      onToast(e2[first]!);
      const el = { name: nameRef, phone: phoneRef, address: addrRef, dest: destRef, courier: optsRef }[first].current;
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    onPlace({ name, phone, address: ship ? address : "" });
  };

  return (
    <>
      <Back onGo={onGo} />
      <div className="title-row">
        <div><h1>{tr("Keranjang")}</h1><p>{pcs} {tr("pcs dari {length} pilihan", { length: cart.length })}</p></div>
        <button className="btn sm ghost danger" data-act="cart-clear" onClick={onClear}>{tr("Kosongkan")}</button>
      </div>
      <div className="cart-grid">
        <section className="panel">
          <ul className="list">
            {cart.map((c, i) => {
              const p = findProduct(data, c.productId);
              const v = variantOf(p, c.variantId);
              if (!p || !v) return null;
              const max = num(v.stock[c.size]);
              const img = variantCover(v) || cover(p);
              const u = unitPrice(p, pcs);
              return (
                <li className="li" key={`${c.productId}|${c.variantId}|${c.size}`}>
                  {img ? <img className="thumb" src={img} alt="" width={72} height={90} loading="lazy" decoding="async" /> : <span className="thumb" aria-hidden="true" />}
                  <div className="grow">
                    <div className="t">{p.name}</div>
                    <div className="s">{v.name ? `${v.name} · ` : ""}{tr("Ukuran")} {c.size}</div>
                    <div className="s unit">{wasPrice(p, u) ? <span className="was">{rp(wasPrice(p, u))}</span> : null}<span className="nw">{rp(u)}{tr("/pcs")}</span></div>
                    <div className="stepper sm">
                      <button type="button" className="btn sm" data-act="cart-dec" data-id={i} aria-label={tr("Kurangi")} onClick={() => onQty(i, c.qty - 1)}>−</button>
                      <span className="num">{c.qty}</span>
                      <button type="button" className="btn sm" data-act="cart-inc" data-id={i} aria-label={tr("Tambah")} disabled={c.qty >= max} onClick={() => onQty(i, c.qty + 1)}>+</button>
                    </div>
                  </div>
                  <div className="r"><div className="v money">{rp(u * c.qty)}</div></div>
                </li>
              );
            })}
          </ul>
          {next ? <div className="tier-note">{tr("Tambah")} {next.min - pcs} {tr("pcs lagi (boleh campur model) supaya {name} jadi {price}/pcs.", { name: next.name, price: rp(next.price) })}</div> : null}
        </section>

        <aside className="cart-aside panel">
          <div className="panel-h"><h2>{tr("Checkout")}</h2></div>
          <div className="panel-b">
            <form className="form" id="checkout" data-form="checkout" onSubmit={submit}>
              <div className="grid2">
                <div className="f"><label htmlFor="co-name">{tr("Nama")}</label>
                  <input ref={nameRef} className="in" id="co-name" name="name" value={buyer.name} onChange={(e) => edit({ name: e.target.value })}
                    autoComplete="name" placeholder={tr("Nama kamu")} maxLength={80} {...errProps(errs, "name")} /><ErrMsg errs={errs} f="name" /></div>
                <div className="f"><label htmlFor="co-phone">{tr("No. WhatsApp")}</label>
                  <input ref={phoneRef} className="in" id="co-phone" name="phone" value={buyer.phone} onChange={(e) => edit({ phone: e.target.value })}
                    type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" maxLength={20} {...errProps(errs, "phone")} />
                  {errs.phone ? <ErrMsg errs={errs} f="phone" /> : <span className="hint">{tr("Pesanan dan ongkir dikabari ke nomor ini.")}</span>}</div>
              </div>
              <div className="f"><span className="lbl">{tr("Pengambilan")}</span>
                <div className="choice" role="group" aria-label={tr("Pengambilan")}>
                  <button type="button" data-act="delivery" data-id="pickup" aria-pressed={!ship} onClick={() => setDelivery("pickup")}>
                    <b>{tr("Diambil di toko")}</b><span>{tr("Tanpa ongkir")}</span></button>
                  <button type="button" data-act="delivery" data-id="ship" aria-pressed={ship} onClick={() => setDelivery("ship")}>
                    <b>{tr("Dikirim")}</b><span>{sc?.live ? tr("Pilih kurir, ongkir langsung dihitung") : tr("Ongkir dikabari toko")}</span></button>
                </div></div>
              {ship && sc?.live ? (
                <ShipBox api={sc.api} slug={sc.slug} dest={sc.dest} onDest={sc.onDest} quote={sc.quote} loading={sc.loading} pick={sc.pick} onPick={sc.onPick} onDown={sc.onDown}
                  err={{ dest: errs.dest, courier: errs.courier }} destRef={destRef} optsRef={optsRef} />
              ) : null}
              {ship ? (
                <div className="f" id="co-addrbox"><label htmlFor="co-addr">{sc?.live ? tr("Alamat (jalan, no. rumah)") : tr("Alamat lengkap")}</label>
                  <textarea ref={addrRef} className="in" id="co-addr" name="address" rows={sc?.live ? 2 : 3} maxLength={500} autoComplete="street-address"
                    placeholder={sc?.live ? tr("Nama jalan, nomor rumah, RT/RW, patokan") : tr("Jalan, RT/RW, kelurahan, kecamatan, kota, kode pos")} value={buyer.address} onChange={(e) => edit({ address: e.target.value })} {...errProps(errs, "address")} />
                  {errs.address ? <ErrMsg errs={errs} f="address" /> : sc?.live ? null : <span className="hint">{tr("Ongkir dikabari toko lewat WhatsApp.")}</span>}
                  {sc?.down ? <div className="ship-down" id="co-ship-down" role="status"><Truck /><span><b>{tr("Ongkir dikabari toko")}</b>{tr("{why} Pesananmu tetap bisa dikirim, toko mengabari ongkirnya lewat WhatsApp.", { why: sc.down })}</span></div>
                    : !sc?.live && freeAreas(data.shipping).length ? <div className="ship-free" id="co-free-note"><Truck /><span>{tr("Gratis ongkir untuk area {areas} (dikonfirmasi toko)", { areas: areaNames(data.shipping) })}</span></div> : null}</div>
              ) : (
                <div className="pickup-box">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                  <div><b>{tr("Ambil di")} {data.shop}</b>{pickupAt || tr("Alamat dan jam ambil dikabari toko lewat WhatsApp.")}</div>
                </div>
              )}
              <div className="f"><label htmlFor="co-note">{tr("Catatan")} <span className="muted" style={{ fontWeight: 400 }}>{tr("(opsional)")}</span></label>
                <input className="in" id="co-note" name="note" value={buyer.note} onChange={(e) => onBuyer({ note: e.target.value })}
                  maxLength={300} placeholder={tr("Contoh: tolong dibungkus kado")} /></div>
              {promoOpen ? (
                <div className="f"><label htmlFor="co-code">{tr("Kode promo")}</label>
                  <div className="promo-row">
                    <input ref={codeRef} className={code && promo ? "in ok" : "in"} id="co-code" value={typed} maxLength={20} autoComplete="off" autoCapitalize="characters" placeholder={tr("Contoh: HEMAT20")}
                      aria-describedby={code ? "co-code-msg" : undefined} aria-invalid={code && fresh && quote!.error ? true : undefined}
                      onChange={(e) => setTyped(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCode(); } }} />
                    {code && typed === code
                      ? <button type="button" className="btn ghost" data-act="code-clear" onClick={() => { setTyped(""); onCode(""); codeRef.current?.focus(); }}>{tr("Hapus")}</button>
                      : <button type="button" className="btn" data-act="code-apply" disabled={!typed.trim()} onClick={applyCode}>{tr("Pakai")}</button>}
                  </div>
                  {code && fresh && quote!.error ? <span className="promo-msg bad" id="co-code-msg" role="alert">{quote!.errorTpl ? tr(quote!.errorTpl, quote!.errorVars) : quote!.error}</span>
                    : code && promo ? <span className="promo-msg ok" id="co-code-msg" role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{tr("Kode {code} dipakai: hemat {rp}", { code, rp: rp(promo.amount) })}</span>
                    : code && !fresh ? <span className="promo-msg" id="co-code-msg">{tr("Mengecek kode…")}</span> : null}
                </div>
              ) : (
                <button type="button" className="link promo-open" data-act="code-open" aria-expanded={false} aria-controls="co-code"
                  onClick={() => { flushSync(() => setPromoOpen(true)); codeRef.current?.focus(); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
                  {tr("Punya kode promo?")}
                </button>
              )}
              <div className="calc" ref={calcRef}>
                <div className="ln"><span className="k">{tr("Subtotal {pcs} pcs", { pcs })}</span><span className="money">{rp(base)}</span></div>
                {save > 0 ? <div className="ln"><span className="k">{tr("Hemat harga grosir")}</span><span className="money" style={{ color: "var(--hue)" }}>−{rp(save)}</span></div> : null}
                {promo ? <div className={flash ? "ln promo-ln flash" : "ln promo-ln"} key={`promo-${flash}`} id="co-promo"><span className="k">{tr("Promo {name}", { name: promo.name })}{promo.code ? <span className="code-tag">{promo.code}</span> : null}</span><span className="money">−{rp(promo.amount)}</span></div> : null}
                <div className="ln" id="co-ongkir"><span className="k">{tr("Ongkir")}{ongkir !== null && sc?.option ? <span className="ln-sub"> · {sc.option.courierName || sc.option.courier.toUpperCase()} {sc.option.service}{fmtEtd(sc.option.etd) ? ` (${fmtEtd(sc.option.etd)})` : ""}</span> : null}</span>
                  <span className={ongkir === 0 ? "money free" : "money"}>{!ship ? tr("tidak ada") : ongkir === 0 ? tr("Gratis") : ongkir !== null ? rp(ongkir) : sc?.live ? (sc.dest ? tr("pilih kurir") : tr("pilih tujuan")) : tr("dikabari toko")}</span></div>
                <div className="ln tot"><span>{tr("Total")}</span><span className="money" id="co-total">{rp(pay)}</span></div>
                {save + off > 0 ? <div className="ln saved"><span>{tr("Kamu hemat {rp}", { rp: rp(save + off) })}</span></div> : null}
              </div>
              <button ref={submitRef} className="btn pri lg full" type="submit" disabled={busy}>{busy ? tr("Mengirim…") : tr("Pesan lewat WhatsApp")}</button>
            </form>
          </div>
        </aside>
      </div>
      {/* phones: the total and the order button stay in reach while the buyer scrolls the cart and the form */}
      <div className={formBtnSeen ? "co-bar off" : "co-bar"} aria-hidden={formBtnSeen || undefined}>
        <div className="co-bar-t"><span className="small">{tr("Total")}{off || save ? <span className="co-bar-save"> · {tr("hemat {rp}", { rp: rpShort(save + off) })}</span> : null}</span><b className="money" id="co-bar-total">{rp(pay)}</b></div>
        <button type="submit" form="checkout" className="btn pri" data-act="co-bar-send" disabled={busy} tabIndex={formBtnSeen ? -1 : undefined}>{busy ? tr("Mengirim…") : tr("Pesan lewat WhatsApp")}</button>
      </div>
    </>
  );
}
