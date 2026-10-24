import { useEffect, useRef, useState } from "react";
import { hasVariants, num, rp, strikePct, tiersOf, variantCover, wasPrice, type sheetState } from "@/lib/store";
import { MoneyBig } from "./Money";
import { Sheet } from "./Sheet";
import { tr } from "@/lib/i18n";

type State = NonNullable<ReturnType<typeof sheetState>>;
type Props = {
  state: State; closing: boolean; onClose: () => void;
  onVariant: (id: string) => void; onSize: (size: string) => void; onQty: (qty: number) => void;
  onView: (index: number) => void; onAdd: () => void; onShare: () => void;
};

export function ProductSheet({ state, closing, onClose, onVariant, onSize, onQty, onView, onAdd, onShare }: Props) {
  const { p, v, sizes, size, have, inCart, max, qty, price, media } = state;
  const tiers = tiersOf(p);
  const gallery = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  // A new variant starts its gallery at the first picture.
  useEffect(() => { if (gallery.current) gallery.current.scrollLeft = 0; setAt(0); }, [v.id]);

  const show = (i: number) => {
    const el = gallery.current?.children[i] as HTMLElement | undefined;
    if (el && gallery.current) gallery.current.scrollTo({ left: el.offsetLeft - gallery.current.offsetLeft, behavior: "smooth" });
    setAt(i);
  };
  const onScroll = () => {
    const g = gallery.current;
    if (!g || !g.children.length) return;
    const w = (g.children[0] as HTMLElement).offsetWidth || 1;
    setAt(Math.min(media.length - 1, Math.round(g.scrollLeft / w)));
  };

  const foot = (
    <button className="btn pri lg" data-act="add-cart" disabled={max <= 0} onClick={onAdd}>
      {max <= 0 ? tr("Stok habis") : tr("Masukkan keranjang · {rp}", { rp: rp(price * qty) })}
    </button>
  );
  return (
    <Sheet title={p.name} closing={closing} onClose={onClose} foot={foot} wide={media.length > 0}>
      <div className="pd">
        {media.length ? (
          <div className="pd-media">
            <div className="gallery" id="gal" ref={gallery} onScroll={onScroll}>
              {media.map((m, i) => (
                <button key={`${i}-${m.url}`} type="button" className="g-item" data-act="view" data-id={i} aria-label={tr("Lihat layar penuh")} onClick={() => onView(i)}>
                  {m.type === "video"
                    ? <><video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" /><span className="g-play" aria-hidden="true" /></>
                    : <img src={m.url} alt="" />}
                </button>
              ))}
            </div>
            {media.length > 1 ? (
              <div className="g-thumbs">
                {media.map((m, i) => (
                  <button key={`${i}-${m.url}`} type="button" aria-label={tr("Foto {v}", { v: i + 1 })} aria-current={i === at} onClick={() => show(i)}>
                    {m.type === "video" ? <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" /> : <img src={m.url} alt="" />}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="pd-info">
          {p.category ? <div className="cat-kind">{p.subcategory ? `${p.category} · ${p.subcategory}` : p.category}</div> : null}
          <div className="pd-price">
            <span className="sum money"><MoneyBig value={price} /></span>
            {wasPrice(p, price) ? <span className="was">{rp(wasPrice(p, price))}</span> : null}
            {strikePct(p) > 0 && price === p.price ? <span className="tag-b sale">−{strikePct(p)}%</span> : null}
            <span className="small muted">{tr("/pcs")}</span>
            <button type="button" className="btn sm ghost share-btn" data-act="share" onClick={onShare}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></svg>{tr("Bagikan")}
            </button>
          </div>
          {tiers.length ? (
            <div className="tiers-box">
              <b>{tr("Harga grosir")}</b>
              <div className="tier-rows">
                {tiers.map((t) => <span key={t.min}>{tr("Beli {min}+ pcs", { min: t.min })}<strong>{rp(t.price)}</strong></span>)}
              </div>
              <span className="small">{tr("Dihitung dari total semua baju di keranjang, boleh campur model.")}</span>
            </div>
          ) : null}
          {hasVariants(p) ? (
            <div className="f"><span className="lbl">{tr("Variasi")}{v.name ? <span className="muted" style={{ fontWeight: 500 }}> · {v.name}</span> : null}</span><div className="chips">
              {p.variants.map((x) => {
                const c = variantCover(x);
                return (
                  <button key={x.id} type="button" className="chip var-chip" data-act="ps-var" data-id={x.id} aria-pressed={x.id === v.id} onClick={() => onVariant(x.id)}>
                    {c ? <img src={c} alt="" /> : null}{x.name || tr("Lainnya")}
                  </button>
                );
              })}
            </div></div>
          ) : null}
          <div className="f"><span className="lbl">{tr("Ukuran")}</span><div className="chips">
            {sizes.map(([sz, n]) => (
              <button key={sz} type="button" className="chip" data-act="ps-size" data-id={sz} aria-pressed={sz === size} disabled={num(n) <= 0} onClick={() => onSize(sz)}>{sz}</button>
            ))}
          </div></div>
          <div className="f"><span className="lbl">{tr("Jumlah")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="stepper">
                <button type="button" className="btn" data-act="ps-dec" aria-label={tr("Kurangi")} onClick={() => onQty(Math.max(1, qty - 1))}>−</button>
                <span className="num">{qty}</span>
                <button type="button" className="btn" data-act="ps-inc" aria-label={tr("Tambah")} disabled={qty >= max} onClick={() => onQty(qty + 1)}>+</button>
              </div>
              <span className="stock-note">{inCart ? tr("{inCart} sudah di keranjang · ", { inCart }) : ""}{tr("stok")} {have}</span>
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
