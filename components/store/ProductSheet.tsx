import { useEffect, useRef, useState } from "react";
import { hasVariants, num, rp, strikePct, tiersOf, variantCover, variantStock, wasPrice, type Media, type Product, type sheetState } from "@/lib/store";
import { MoneyBig } from "./Money";
import { Sheet } from "./Sheet";
import { Description } from "./Description";
import { tr } from "@/lib/i18n";

type State = NonNullable<ReturnType<typeof sheetState>>;
type Actions = {
  onVariant: (id: string) => void; onSize: (size: string) => void; onQty: (qty: number) => void;
  onView: (index: number) => void; onAdd: () => void; onShare: () => void;
};

/** "Rp58rb" for round thousands (the compact wholesale line), else the full amount. */
export const rpShort = (v: number) => {
  const n = Math.round(num(v));
  if (n >= 1000 && n % 100 === 0) return `Rp${(n / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`;
  return rp(n);
};

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></svg>
);

/** Swipeable photos with dots on phones, thumbnails from tablet up; a tap opens the zoomable viewer. */
function Gallery({ media, alt, resetKey, onView }: { media: Media[]; alt: (i: number) => string; resetKey: string; onView: (i: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  // A new variant starts its gallery at the first picture.
  useEffect(() => { if (track.current) track.current.scrollLeft = 0; setAt(0); }, [resetKey]);
  const show = (i: number) => {
    const g = track.current, el = g?.children[i] as HTMLElement | undefined;
    if (g && el) g.scrollTo({ left: el.offsetLeft - g.offsetLeft - (g.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    setAt(i);
  };
  const onScroll = () => {
    const g = track.current;
    if (!g || !g.children.length) return;
    // the slide whose centre is closest to the track's centre
    const mid = g.scrollLeft + g.clientWidth / 2;
    let best = 0, gap = Infinity;
    [...g.children].forEach((c, i) => { const el = c as HTMLElement; const d = Math.abs(el.offsetLeft - g.offsetLeft + el.offsetWidth / 2 - mid); if (d < gap) { gap = d; best = i; } });
    setAt(best);
  };
  if (!media.length) return null;
  return (
    <div className="pd-media">
      <div className={media.length > 1 ? "gallery" : "gallery one"} id="gal" ref={track} onScroll={onScroll} aria-roledescription={tr("galeri")}>
        {media.map((m, i) => (
          <button key={`${i}-${m.url}`} type="button" className="g-item" data-act="view" data-id={i} aria-label={tr("Perbesar foto {n} dari {total}", { n: i + 1, total: media.length })} onClick={() => onView(i)}>
            {m.type === "video"
              ? <><video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" /><span className="g-play" aria-hidden="true" /></>
              : <img src={m.url} alt={alt(i)} loading={i ? "lazy" : "eager"} decoding="async" width={400} height={500} />}
          </button>
        ))}
      </div>
      {media.length > 1 ? (
        <>
          <div className="g-dots" aria-hidden="true">{media.map((m, i) => <i key={`${i}-${m.url}`} className={i === at ? "on" : ""} />)}</div>
          <div className="g-thumbs">
            {media.map((m, i) => (
              <button key={`${i}-${m.url}`} type="button" aria-label={tr("Foto {v}", { v: i + 1 })} aria-current={i === at} onClick={() => show(i)}>
                {m.type === "video" ? <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" /> : <img src={m.url} alt="" width={60} height={75} loading="lazy" decoding="async" />}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Baru / Terlaris / Habis, from the POS (v2 catalog). */
function Badges({ p }: { p: Product }) {
  if (!p.isNew && !p.bestseller && !p.soldOut) return null;
  return (
    <div className="pd-badges">
      {p.soldOut ? <span className="pd-badge out">{tr("Habis")}</span> : null}
      {p.isNew ? <span className="pd-badge new">{tr("Baru")}</span> : null}
      {p.bestseller ? <span className="pd-badge best">{p.bestsellerRank === 1 ? tr("Terlaris #1") : tr("Terlaris")}</span> : null}
    </div>
  );
}

/** Wholesale prices as one line ("Beli 3+ Rp58rb · 6+ Rp52rb") that opens the full table. */
function Tiers({ p }: { p: Product }) {
  const tiers = tiersOf(p);
  const [open, setOpen] = useState(false);
  if (!tiers.length) return null;
  const line = tiers.map((t, i) => (i ? `${t.min}+ ${rpShort(t.price)}` : tr("Beli {min}+ {price}", { min: t.min, price: rpShort(t.price) }))).join(" · ");
  return (
    <div className={open ? "tier-fold open" : "tier-fold"}>
      <button type="button" className="tier-line" data-act="tiers" aria-expanded={open} aria-controls="tier-table" onClick={() => setOpen(!open)}>
        <span className="tier-k">{tr("Grosir")}</span><span className="tier-v">{line}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open ? (
        <div className="tiers-box" id="tier-table">
          <div className="tier-rows">
            {tiers.map((t) => <span key={t.min}>{tr("Beli {min}+ pcs", { min: t.min })}<strong>{rp(t.price)}</strong></span>)}
          </div>
          <span className="small">{tr("Dihitung dari total semua baju di keranjang, boleh campur model.")}</span>
        </div>
      ) : null}
    </div>
  );
}

/** The add button: what it adds (qty × price) under the label; disabled with the reason when nothing can be added. */
export function AddButton({ state, onAdd }: { state: State; onAdd: () => void }) {
  const { p, v, max, qty, price, have } = state;
  const out = p.soldOut ? tr("Stok habis") : variantStock(v) <= 0 ? tr("Variasi ini habis") : have <= 0 ? tr("Ukuran ini habis") : max <= 0 ? tr("Semua stok sudah di keranjang") : "";
  return (
    <button className="btn pri lg add-btn" data-act="add-cart" disabled={!!out} onClick={onAdd}>
      {out ? out : (
        <>
          <span className="add-l">{tr("Masukkan keranjang")}</span>
          <span className="add-s money">{qty > 1 ? `${qty} × ${rp(price)} = ` : ""}<b>{rp(price * qty)}</b></span>
        </>
      )}
    </button>
  );
}

/** Name, price, badges, choices and description: the same on the sheet and on the product page. */
function Details({ state, heading, onVariant, onSize, onQty, onShare, foot, perks }: Omit<Actions, "onView" | "onAdd"> & { state: State; heading: "h1" | "h2"; foot?: React.ReactNode; perks?: React.ReactNode }) {
  const { p, v, sizes, size, have, inCart, max, qty, price } = state;
  const H = heading;
  return (
    <div className="pd-info">
      <div className="pd-head">
        {p.category ? <div className="cat-kind">{p.subcategory ? `${p.category} · ${p.subcategory}` : p.category}</div> : null}
        <H className="pd-name">{p.name}</H>
        <div className="pd-price">
          <span className="sum money"><MoneyBig value={price} /></span>
          {wasPrice(p, price) ? <span className="was">{rp(wasPrice(p, price))}</span> : null}
          {strikePct(p) > 0 && price === p.price ? <span className="tag-b sale">−{strikePct(p)}%</span> : null}
          <span className="small muted">{tr("/pcs")}</span>
        </div>
        <Badges p={p} />
        <Tiers p={p} />
        {perks}
      </div>
      {hasVariants(p) ? (
        <div className="f"><span className="lbl">{tr("Variasi")}{v.name ? <span className="muted" style={{ fontWeight: 500 }}> · {v.name}</span> : null}</span><div className="chips">
          {p.variants.map((x) => {
            const c = variantCover(x);
            const gone = variantStock(x) <= 0;
            return (
              <button key={x.id} type="button" className={gone ? "chip var-chip gone" : "chip var-chip"} data-act="ps-var" data-id={x.id} aria-pressed={x.id === v.id}
                aria-label={gone ? tr("{v}, habis", { v: x.name || tr("Lainnya") }) : undefined} onClick={() => onVariant(x.id)}>
                {c ? <img src={c} alt="" width={28} height={28} loading="lazy" decoding="async" /> : null}{x.name || tr("Lainnya")}
              </button>
            );
          })}
        </div></div>
      ) : null}
      {sizes.length ? (
        <div className="f"><span className="lbl">{tr("Ukuran")}</span><div className="chips">
          {sizes.map(([sz, n]) => {
            const gone = num(n) <= 0;
            return (
              <button key={sz} type="button" className="chip" data-act="ps-size" data-id={sz} aria-pressed={sz === size && !gone} disabled={gone}
                aria-label={gone ? tr("{v}, habis", { v: sz }) : undefined} onClick={() => onSize(sz)}><span className="chip-t">{sz}</span>{gone ? <span className="chip-out" aria-hidden="true">{tr("Habis")}</span> : null}</button>
            );
          })}
        </div>
        </div>
      ) : null}
      {have > 0 ? (
        <div className="f"><span className="lbl">{tr("Jumlah")}</span>
          <div className="qty-row">
            <div className="stepper">
              <button type="button" className="btn" data-act="ps-dec" aria-label={tr("Kurangi")} disabled={qty <= 1} onClick={() => onQty(Math.max(1, qty - 1))}>−</button>
              <span className="num" aria-live="polite">{qty}</span>
              <button type="button" className="btn" data-act="ps-inc" aria-label={tr("Tambah")} disabled={qty >= max} onClick={() => onQty(qty + 1)}>+</button>
            </div>
            <span className="stock-note">{inCart ? tr("{inCart} sudah di keranjang · ", { inCart }) : ""}{have <= 3 ? <b className="low">{tr("sisa {n}", { n: have })}</b> : <>{tr("stok")} {have}</>}</span>
          </div>
        </div>
      ) : null}
      {foot}
      <Description html={p.description} />
    </div>
  );
}

const altOf = (state: State) => (i: number) => tr("{name}{v} foto {n}", { name: state.p.name, v: state.v.name ? " " + state.v.name : "", n: i + 1 });

/** The product as a bottom sheet (phones) / two-column dialog (tablet up), opened from the catalog. */
export function ProductSheet({ state, closing, onClose, onVariant, onSize, onQty, onView, onAdd, onShare, perks }: Actions & { state: State; closing: boolean; onClose: () => void; perks?: React.ReactNode }) {
  const { p, v, media } = state;
  const share = <button type="button" className="btn sm ghost share-btn" data-act="share" onClick={onShare}><ShareIcon />{tr("Bagikan")}</button>;
  return (
    <Sheet title={p.name} bare lead={share} closing={closing} onClose={onClose} foot={<AddButton state={state} onAdd={onAdd} />} wide={media.length > 0} returnFocus>
      <div className="pd">
        <Gallery media={media} alt={altOf(state)} resetKey={v.id} onView={onView} />
        <Details state={state} heading="h2" onVariant={onVariant} onSize={onSize} onQty={onQty} onShare={onShare} perks={perks} />
      </div>
    </Sheet>
  );
}

/** The product on its own page (a /p/<product> link opened directly): gallery | details from tablet up. */
export function ProductPage({ state, onBack, onVariant, onSize, onQty, onView, onAdd, onShare, perks }: Actions & { state: State; onBack: () => void; perks?: React.ReactNode }) {
  const { v, media } = state;
  return (
    <>
      <div className="pd-top">
        <button className="back" data-act="close" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>{tr("Semua produk")}
        </button>
        <button type="button" className="btn sm ghost share-btn" data-act="share" onClick={onShare}><ShareIcon />{tr("Bagikan")}</button>
      </div>
      <article className={media.length ? "pd pd-page" : "pd pd-page no-media"}>
        <Gallery media={media} alt={altOf(state)} resetKey={v.id} onView={onView} />
        <Details state={state} heading="h1" onVariant={onVariant} onSize={onSize} onQty={onQty} onShare={onShare} perks={perks}
          foot={<div className="pd-buy"><AddButton state={state} onAdd={onAdd} /></div>} />
      </article>
    </>
  );
}
