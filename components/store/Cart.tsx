import { useRef, type FormEvent } from "react";
import { flushSync } from "react-dom";
import type { StoreData } from "@/lib/pos";
import { tr } from "@/lib/i18n";
import {
  cartBase, cartPcs, cartTotal, cover, findProduct, nextTier, normBrand, num, rp, unitPrice, variantCover, variantOf,
  type Buyer, type CartLine, type Delivery, type View,
} from "@/lib/store";

export type Checkout = { name: string; phone: string; address: string };
type Props = {
  data: StoreData; cart: CartLine[]; buyer: Buyer; busy: boolean;
  onGo: (v: View) => void; onQty: (index: number, qty: number) => void; onClear: () => void;
  onBuyer: (patch: Partial<Buyer>) => void; onToast: (msg: string) => void; onPlace: (c: Checkout) => void;
};

const Back = ({ onGo }: { onGo: (v: View) => void }) => (
  <button className="back" data-act="go" data-id="katalog" onClick={() => onGo("katalog")}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>{tr("Lanjut belanja")}
  </button>
);

export function Cart({ data, cart, buyer, busy, onGo, onQty, onClear, onBuyer, onToast, onPlace }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addrRef = useRef<HTMLTextAreaElement>(null);

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
  const ship = buyer.delivery === "ship";
  const pickupAt = normBrand(data.brand).address;

  const setDelivery = (d: Delivery) => {
    // Render the address box first so it can take the focus.
    flushSync(() => onBuyer({ delivery: d }));
    if (d === "ship") addrRef.current?.focus();
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const name = buyer.name.trim(), phone = buyer.phone.replace(/[^\d+]/g, ""), address = buyer.address.trim();
    if (!name) { onToast(tr("Isi nama kamu dulu")); nameRef.current?.focus(); return; }
    if (phone.replace(/\D/g, "").length < 9) { onToast(tr("Isi nomor WhatsApp yang aktif")); phoneRef.current?.focus(); return; }
    if (ship && address.length < 10) { onToast(tr("Isi alamat lengkap untuk pengiriman")); addrRef.current?.focus(); return; }
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
                  {img ? <img className="thumb" src={img} alt="" /> : <span className="thumb" aria-hidden="true" />}
                  <div className="grow">
                    <div className="t">{p.name}</div>
                    <div className="s">{v.name ? `${v.name} · ` : ""}{tr("Ukuran")} {c.size}</div>
                    <div className="s">{u < p.price ? <span className="was">{rp(p.price)}</span> : null}{rp(u)}{tr("/pcs")}</div>
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
                  <input ref={nameRef} className="in" id="co-name" name="name" value={buyer.name} onChange={(e) => onBuyer({ name: e.target.value })}
                    autoComplete="name" placeholder={tr("Nama kamu")} maxLength={80} /></div>
                <div className="f"><label htmlFor="co-phone">{tr("No. WhatsApp")}</label>
                  <input ref={phoneRef} className="in" id="co-phone" name="phone" value={buyer.phone} onChange={(e) => onBuyer({ phone: e.target.value })}
                    type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" maxLength={20} /></div>
              </div>
              <div className="f"><span className="lbl">{tr("Pengambilan")}</span>
                <div className="choice" role="group" aria-label={tr("Pengambilan")}>
                  <button type="button" data-act="delivery" data-id="pickup" aria-pressed={!ship} onClick={() => setDelivery("pickup")}>
                    <b>{tr("Diambil di toko")}</b><span>{tr("Tanpa ongkir")}</span></button>
                  <button type="button" data-act="delivery" data-id="ship" aria-pressed={ship} onClick={() => setDelivery("ship")}>
                    <b>{tr("Dikirim")}</b><span>{tr("Ongkir dikabari toko")}</span></button>
                </div></div>
              {ship ? (
                <div className="f" id="co-addrbox"><label htmlFor="co-addr">{tr("Alamat lengkap")}</label>
                  <textarea ref={addrRef} className="in" id="co-addr" name="address" rows={3} maxLength={500} autoComplete="street-address"
                    placeholder={tr("Jalan, RT/RW, kelurahan, kecamatan, kota, kode pos")} value={buyer.address} onChange={(e) => onBuyer({ address: e.target.value })} />
                  <span className="hint">{tr("Ongkir dikabari toko lewat WhatsApp.")}</span></div>
              ) : (
                <div className="pickup-box">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                  <div><b>{tr("Ambil di")} {data.shop}</b>{pickupAt || tr("Alamat dan jam ambil dikabari toko lewat WhatsApp.")}</div>
                </div>
              )}
              <div className="f"><label htmlFor="co-note">{tr("Catatan")} <span className="muted" style={{ fontWeight: 400 }}>{tr("(opsional)")}</span></label>
                <input className="in" id="co-note" name="note" value={buyer.note} onChange={(e) => onBuyer({ note: e.target.value })}
                  maxLength={300} placeholder={tr("Contoh: tolong dibungkus kado")} /></div>
              <div className="calc">
                <div className="ln"><span className="k">{tr("Subtotal {pcs} pcs", { pcs })}</span><span className="money">{rp(base)}</span></div>
                {save > 0 ? <div className="ln"><span className="k">{tr("Hemat harga grosir")}</span><span className="money" style={{ color: "var(--hue)" }}>−{rp(save)}</span></div> : null}
                <div className="ln"><span className="k">{tr("Ongkir")}</span><span>{ship ? tr("dikabari toko") : tr("tidak ada")}</span></div>
                <div className="ln tot"><span>{tr("Total")}</span><span className="money" id="co-total">{rp(total)}</span></div>
              </div>
              <button className="btn pri lg full" type="submit" disabled={busy}>{busy ? tr("Mengirim…") : tr("Pesan lewat WhatsApp")}</button>
              <div className="small muted">{tr("Pesananmu tercatat di {shop}, lalu WhatsApp terbuka dengan pesan yang sudah terisi. Tinggal tekan kirim.", { shop: data.shop })}</div>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
