import { useEffect, useRef } from "react";
import { hasVariants, num, rp, tiersOf, variantCover, type sheetState } from "@/lib/store";
import { MoneyBig } from "./Money";
import { Sheet } from "./Sheet";

type State = NonNullable<ReturnType<typeof sheetState>>;
type Props = {
  state: State; closing: boolean; onClose: () => void;
  onVariant: (id: string) => void; onSize: (size: string) => void; onQty: (qty: number) => void;
  onView: (index: number) => void; onAdd: () => void;
};

export function ProductSheet({ state, closing, onClose, onVariant, onSize, onQty, onView, onAdd }: Props) {
  const { p, v, sizes, size, have, inCart, max, qty, price, media } = state;
  const tiers = tiersOf(p);
  const gallery = useRef<HTMLDivElement>(null);
  // A new variant starts its gallery at the first picture.
  useEffect(() => { if (gallery.current) gallery.current.scrollLeft = 0; }, [v.id]);

  const foot = (
    <button className="btn pri" data-act="add-cart" disabled={max <= 0} onClick={onAdd}>
      {max <= 0 ? "Stok habis" : `Masukkan keranjang · ${rp(price * qty)}`}
    </button>
  );
  return (
    <Sheet title={p.name} closing={closing} onClose={onClose} foot={foot}>
      <div className="form">
        {media.length ? (
          <div className="gallery" id="gal" ref={gallery}>
            {media.map((m, i) => (
              <button key={`${i}-${m.url}`} type="button" className="g-item" data-act="view" data-id={i} aria-label="Lihat layar penuh" onClick={() => onView(i)}>
                {m.type === "video"
                  ? <><video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" /><span className="g-play" aria-hidden="true" /></>
                  : <img src={m.url} alt="" />}
              </button>
            ))}
          </div>
        ) : null}
        <div className="sum money">{price < p.price ? <span className="was">{rp(p.price)}</span> : null}<MoneyBig value={price} /></div>
        {tiers.length ? (
          <div className="tiers-box">
            <b>Harga grosir</b>
            {tiers.map((t) => <span key={t.min}>Beli {t.min}+ pcs: {rp(t.price)}/pcs</span>)}
            <span className="small" style={{ opacity: 0.8 }}>Dihitung dari total semua baju di keranjang, boleh campur model.</span>
          </div>
        ) : null}
        {hasVariants(p) ? (
          <div className="f"><span className="lbl">Variasi</span><div className="chips">
            {p.variants.map((x) => {
              const c = variantCover(x);
              return (
                <button key={x.id} type="button" className="chip var-chip" data-act="ps-var" data-id={x.id} aria-pressed={x.id === v.id} onClick={() => onVariant(x.id)}>
                  {c ? <img src={c} alt="" /> : null}{x.name || "Lainnya"}
                </button>
              );
            })}
          </div></div>
        ) : null}
        <div className="f"><span className="lbl">Ukuran</span><div className="chips">
          {sizes.map(([sz, n]) => (
            <button key={sz} type="button" className="chip" data-act="ps-size" data-id={sz} aria-pressed={sz === size} disabled={num(n) <= 0} onClick={() => onSize(sz)}>{sz}</button>
          ))}
        </div></div>
        <div className="f"><span className="lbl">Jumlah</span><div className="stepper">
          <button type="button" className="btn" data-act="ps-dec" aria-label="Kurangi" onClick={() => onQty(Math.max(1, qty - 1))}>−</button>
          <span className="num">{qty}</span>
          <button type="button" className="btn" data-act="ps-inc" aria-label="Tambah" disabled={qty >= max} onClick={() => onQty(qty + 1)}>+</button>
          <span className="small muted">{inCart ? `${inCart} sudah di keranjang · ` : ""}stok {have}</span>
        </div></div>
      </div>
    </Sheet>
  );
}
