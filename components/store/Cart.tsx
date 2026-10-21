import { useRef, type FormEvent } from "react";
import { flushSync } from "react-dom";
import type { StoreData } from "@/lib/pos";
import {
  cartBase, cartPcs, cartTotal, cover, findProduct, nextTier, num, rp, unitPrice, variantCover, variantOf,
  type Buyer, type CartLine, type Delivery, type View,
} from "@/lib/store";

export type Checkout = { name: string; phone: string; address: string };
type Props = {
  data: StoreData; cart: CartLine[]; buyer: Buyer; busy: boolean;
  onGo: (v: View) => void; onQty: (index: number, qty: number) => void; onClear: () => void;
  onBuyer: (patch: Partial<Buyer>) => void; onToast: (msg: string) => void; onPlace: (c: Checkout) => void;
};

export function Cart({ data, cart, buyer, busy, onGo, onQty, onClear, onBuyer, onToast, onPlace }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addrRef = useRef<HTMLTextAreaElement>(null);

  if (!cart.length) {
    return (
      <>
        <div className="title-row"><div><h1>Keranjang</h1></div></div>
        <section className="panel"><div className="empty"><b>Keranjang kosong.</b> Pilih baju di <button className="link" data-act="go" data-id="katalog" onClick={() => onGo("katalog")}>katalog</button>.</div></section>
      </>
    );
  }
  const pcs = cartPcs(cart);
  const total = cartTotal(data, cart);
  const base = cartBase(data, cart);
  const save = base - total;
  const next = nextTier(data, cart);
  const ship = buyer.delivery === "ship";

  const setDelivery = (d: Delivery) => {
    // Render the address box first so it can take the focus.
    flushSync(() => onBuyer({ delivery: d }));
    if (d === "ship") addrRef.current?.focus();
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const name = buyer.name.trim(), phone = buyer.phone.replace(/[^\d+]/g, ""), address = buyer.address.trim();
    if (!name) { onToast("Isi nama kamu dulu"); nameRef.current?.focus(); return; }
    if (phone.replace(/\D/g, "").length < 9) { onToast("Isi nomor WhatsApp yang aktif"); phoneRef.current?.focus(); return; }
    if (ship && address.length < 10) { onToast("Isi alamat lengkap untuk pengiriman"); addrRef.current?.focus(); return; }
    onPlace({ name, phone, address });
  };

  return (
    <>
      <div className="title-row">
        <div><h1>Keranjang</h1><p>{pcs} pcs · <button className="link" data-act="go" data-id="katalog" onClick={() => onGo("katalog")}>tambah baju lain</button></p></div>
        <button className="btn sm ghost danger" data-act="cart-clear" onClick={onClear}>Kosongkan</button>
      </div>
      <section className="panel">
        <ul className="list" style={{ paddingTop: 8 }}>
          {cart.map((c, i) => {
            const p = findProduct(data, c.productId);
            const v = variantOf(p, c.variantId);
            if (!p || !v) return null;
            const max = num(v.stock[c.size]);
            const img = variantCover(v) || cover(p);
            const u = unitPrice(p, pcs);
            return (
              <li className="li" key={`${c.productId}|${c.variantId}|${c.size}`}>
                {img ? <img className="thumb sm" src={img} alt="" /> : null}
                <div className="grow">
                  <div className="t">{p.name}</div>
                  <div className="s">{v.name ? `${v.name} · ` : ""}Ukuran {c.size} · {u < p.price ? <span className="was">{rp(p.price)}</span> : null}{rp(u)}/pcs</div>
                  <div className="stepper sm">
                    <button type="button" className="btn sm" data-act="cart-dec" data-id={i} aria-label="Kurangi" onClick={() => onQty(i, c.qty - 1)}>−</button>
                    <span className="num">{c.qty}</span>
                    <button type="button" className="btn sm" data-act="cart-inc" data-id={i} aria-label="Tambah" disabled={c.qty >= max} onClick={() => onQty(i, c.qty + 1)}>+</button>
                  </div>
                </div>
                <div className="r"><div className="v money">{rp(u * c.qty)}</div></div>
              </li>
            );
          })}
        </ul>
        {next ? (
          <div className="panel-b" style={{ paddingTop: 0 }}>
            <div className="tier-hint" style={{ fontSize: 13.5 }}>Tambah {next.min - pcs} pcs lagi (boleh campur model) supaya {next.name} jadi {rp(next.price)}/pcs.</div>
          </div>
        ) : null}
      </section>
      <section className="panel"><div className="panel-b">
        <form className="form" id="checkout" data-form="checkout" style={{ paddingBottom: 0 }} onSubmit={submit}>
          <div className="calc">
            {save > 0 ? (
              <>
                <div className="ln"><span className="k">Harga normal</span><span className="money">{rp(base)}</span></div>
                <div className="ln"><span className="k">Hemat harga grosir</span><span className="money" style={{ color: "var(--hue)" }}>−{rp(save)}</span></div>
              </>
            ) : null}
            <div className="ln tot"><span>Total {pcs} pcs</span><span className="money" id="co-total">{rp(total)}</span></div>
          </div>
          <div className="f"><label htmlFor="co-name">Nama</label>
            <input ref={nameRef} className="in" id="co-name" name="name" value={buyer.name} onChange={(e) => onBuyer({ name: e.target.value })}
              autoComplete="name" placeholder="Nama kamu" maxLength={80} /></div>
          <div className="f"><label htmlFor="co-phone">No. WhatsApp</label>
            <input ref={phoneRef} className="in" id="co-phone" name="phone" value={buyer.phone} onChange={(e) => onBuyer({ phone: e.target.value })}
              type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" maxLength={20} /></div>
          <div className="f"><span className="lbl">Pengambilan</span>
            <div className="seg full" role="group" aria-label="Pengambilan">
              <button type="button" data-act="delivery" data-id="pickup" aria-pressed={!ship} onClick={() => setDelivery("pickup")}>Diambil di toko</button>
              <button type="button" data-act="delivery" data-id="ship" aria-pressed={ship} onClick={() => setDelivery("ship")}>Dikirim</button>
            </div></div>
          <div className="f" id="co-addrbox" hidden={!ship}><label htmlFor="co-addr">Alamat lengkap</label>
            <textarea ref={addrRef} className="in" id="co-addr" name="address" rows={3} maxLength={500} autoComplete="street-address"
              placeholder="Jalan, RT/RW, kelurahan, kecamatan, kota, kode pos" value={buyer.address} onChange={(e) => onBuyer({ address: e.target.value })} />
            <span className="hint">Ongkir dikabari toko lewat WhatsApp.</span></div>
          <div className="f"><label htmlFor="co-note">Catatan <span className="muted" style={{ fontWeight: 400 }}>(opsional)</span></label>
            <input className="in" id="co-note" name="note" value={buyer.note} onChange={(e) => onBuyer({ note: e.target.value })}
              maxLength={300} placeholder="Contoh: tolong dibungkus kado" /></div>
          <button className="btn pri full" type="submit" disabled={busy}>{busy ? "Mengirim…" : "Pesan lewat WhatsApp"}</button>
          <div className="small muted">Pesananmu tercatat di {data.shop}, lalu WhatsApp terbuka dengan pesan yang sudah terisi. Tinggal tekan kirim.</div>
        </form>
      </div></section>
    </>
  );
}
