import type { StoreData } from "@/lib/pos";
import { cover, normBrand, num, promoTerms, promoTitle, rp, sizeEntries, strikePct, tierHint, tiersOf, variantCover, wasPrice, type Browse, type Product, type Sort } from "@/lib/store";
import { tr } from "@/lib/i18n";

/** via: name of the reseller whose link the buyer came through. browse: category / sort / filter, owned by the
 *  storefront so they survive a visit to the cart. */
type Props = { data: StoreData; query: string; via?: string; onProduct: (id: string) => void; onClearQuery: () => void;
  browse: Browse; onBrowse: (patch: Partial<Browse>) => void;
  /** Shares the catalog (WhatsApp-friendly list of products); hidden when not given. */
  onShare?: () => void };

const OTHER = "\u0000other";
const SORTS: [Sort, string][] = [["rec", "Rekomendasi"], ["low", "Harga terendah"], ["high", "Harga tertinggi"], ["name", "Nama A–Z"]];
const stockOf = (p: Product) => p.variants.reduce((a, v) => a + Object.values(v.stock).reduce((b, n) => b + num(n), 0), 0);
/** More sizes than this collapse into one "Ukuran" picker instead of a row of chips. */
const SIZE_CHIPS_MAX = 6;
/** Swatches shown on a card; the rest are counted as "+N". */
const SWATCHES_MAX = 4;
/** Cards above the fold load at once; the rest load as they scroll in. */
const EAGER_CARDS = 2;
const sizesOf = (d: StoreData, p: Product) =>
  [...new Set(p.variants.flatMap((v) => sizeEntries(d, v.stock).filter(([, n]) => num(n) > 0).map(([k]) => k)))];

/** Badge priority on a card; at most CARD_BADGES are shown. */
const CARD_BADGES = 2;
/** A home row ("Terlaris", "Baru datang") needs at least this many products, else it is left out. */
const ROW_MIN = 2;
const ROW_MAX = 10;
export const isSoldOut = (p: Product) => p.soldOut ?? stockOf(p) <= 0;
/** Sold-out products go last whatever the sort (stable, so the chosen order holds within each group). */
const outLast = (a: Product, b: Product) => Number(isSoldOut(a)) - Number(isSoldOut(b));
/** The lowest number of pcs that unlocks a wholesale price anywhere in the shop. */
const wholesaleMin = (d: StoreData) => Math.min(Infinity, ...d.products.filter((p) => !isSoldOut(p)).flatMap((p) => tiersOf(p).map((t) => t.min)));
/** Bestsellers by rank, then new arrivals, then the rest: what a shared catalog leads with. */
export function featured(d: StoreData) {
  const score = (p: Product) => (p.bestseller ? (p.bestsellerRank || 50) : p.isNew ? 100 : 1000);
  return d.products.filter((p) => !isSoldOut(p)).map((p, i) => ({ p, i })).sort((a, b) => score(a.p) - score(b.p) || a.i - b.i).map((x) => x.p);
}

export function Catalog({ data, query, via, onProduct, onClearQuery, browse, onBrowse, onShare }: Props) {
  // filter: "all", "tier" or a size; cat: "" = all, OTHER = products without a category; sub: within cat, "" = all of cat
  const { filter, sort, cat, sub } = browse;
  const setFilter = (f: string) => onBrowse({ filter: f });
  const setSort = (v: Sort) => onBrowse({ sort: v });
  const setSub = (k: string) => onBrowse({ sub: k });
  const setCat = (k: string) => onBrowse({ cat: k, sub: "" });
  const brand = normBrand(data.brand);
  const s = query.trim().toLowerCase();

  // Size filters only list sizes some product still has (0-stock sizes of a v2 catalog do not count).
  const sizes = (data.sizes || []).filter((z) => data.products.some((p) => sizesOf(data, p).includes(z)));
  const anyTier = data.products.some((p) => tiersOf(p).length);
  const cats = data.categories?.length ? data.categories : [...new Set(data.products.map((p) => p.category || "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
  const anyOther = cats.length > 0 && data.products.some((p) => !p.category);
  const subs = cat && cat !== OTHER ? data.subcategories?.[cat] || [] : [];
  const inCat = (p: Product) => !cat || (cat === OTHER ? !p.category : p.category === cat && (!sub || p.subcategory === sub));
  const list = data.products
    .filter(inCat)
    .filter((p) => !s || `${p.name} ${p.category || ""} ${p.subcategory || ""}`.toLowerCase().includes(s))
    .filter((p) => filter === "all" || (filter === "tier" ? tiersOf(p).length > 0 && !isSoldOut(p) : sizesOf(data, p).includes(filter)));
  if (sort === "low") list.sort((a, b) => a.price - b.price);
  else if (sort === "high") list.sort((a, b) => b.price - a.price);
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "id"));
  list.sort(outLast);

  const minPcs = wholesaleMin(data);
  const links = shopLinks(data);
  // Up to three in-stock products with a photo, a collage on wide screens only (and only with two or more).
  const shots = data.products.filter((p) => cover(p) && !isSoldOut(p)).slice(0, 3);
  const collage = shots.length >= 2 ? shots : [];
  const heroWa = links.find((l) => l.k === "wa");
  const manySizes = sizes.length > SIZE_CHIPS_MAX;
  const deals = data.promos || [];

  // Home rows: only on the plain home list (no search, category or filter), and only with enough products.
  const plain = !s && !cat && filter === "all";
  const live = data.products.filter((p) => !isSoldOut(p));
  const best = live.filter((p) => p.bestseller).sort((a, b) => (a.bestsellerRank || 99) - (b.bestsellerRank || 99)).slice(0, ROW_MAX);
  const fresh = live.filter((p) => p.isNew).slice(0, ROW_MAX);
  const rows = plain ? ([["best", tr("Terlaris"), best], ["new", tr("Baru datang"), fresh]] as const).filter(([, , ps]) => ps.length >= ROW_MIN) : [];

  return (
    <>
      {via ? (
        <div className="via-band" id="via-ref" role="note">
          <span className="via-av" aria-hidden="true">{via.trim().slice(0, 1).toUpperCase()}</span>
          <div className="via-txt">
            <b>{tr("Kamu belanja lewat {name}", { name: via })}</b>
            <span>{tr("Pesananmu tetap dikirim dan diproses langsung oleh {shop}.", { shop: data.shop })}</span>
          </div>
          {onShare ? <button type="button" className="via-share" data-act="share-catalog" aria-label={tr("Bagikan katalog")} onClick={onShare}><Share /><span>{tr("Bagikan katalog")}</span></button> : null}
        </div>
      ) : null}
      <section className={collage.length ? "hero-band has-shots" : "hero-band"}>
        <div className="hero-txt">
          <div className="hero-id">
            {brand.logo ? <img className="hero-logo" src={encodeURI(brand.logo)} alt="" width={52} height={52} decoding="async" /> : null}
            <h1>{data.shop}</h1>
          </div>
          {data.intro ? <p className="hero-intro">{data.intro}</p> : <p className="hero-intro">{tr("Pilih baju, masukkan keranjang, lalu kirim pesanan lewat WhatsApp.")}</p>}
          {brand.address ? <span className="hero-addr"><Pin />{brand.address}</span> : null}
          {heroWa || onShare ? (
            <div className="hero-links">
              {heroWa ? <a className="hl hl-main" data-link="wa" href={heroWa.href} target="_blank" rel="noopener noreferrer">{heroWa.icon}{tr("Chat WhatsApp")}</a> : null}
              {onShare && !via ? <button type="button" className="hl hl-share" data-act="share-catalog" aria-label={tr("Bagikan katalog")} onClick={onShare}><Share /><span>{tr("Bagikan katalog")}</span></button> : null}
            </div>
          ) : null}
        </div>
        {collage.length ? (
          <div className={`hero-shots n${collage.length}`}>
            {collage.map((p, i) => (
              <button type="button" key={p.id} className={`shot s${i}`} data-act="product" data-id={p.id} aria-label={p.name} tabIndex={-1} onClick={() => onProduct(p.id)}>
                <img src={cover(p)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        ) : null}
      </section>
      {Number.isFinite(minPcs) || deals.length ? (
        <div className="deals" role="list" aria-label={tr("Promo")}>
          {deals.slice(0, 3).map((p, i) => {
            const terms = promoTerms(p);
            return (
              <div className="deal" role="listitem" key={i}>
                <i className="deal-ic" aria-hidden="true"><Pct /></i>
                <div><b>{promoTitle(p)} <span className="deal-k">{p.name}</span></b><span>{terms || tr("Otomatis terpotong di keranjang.")}</span></div>
              </div>
            );
          })}
          {Number.isFinite(minPcs) ? (
            <button type="button" className="deal deal-tier" role="listitem" data-act="filter-tier" onClick={() => setFilter("tier")}>
              <i className="deal-ic" aria-hidden="true"><Stack /></i>
              <div><b>{tr("Grosir mulai {min} pcs", { min: minPcs })}</b><span>{tr("Boleh campur model dan ukuran.")}</span></div>
            </button>
          ) : null}
        </div>
      ) : null}

      {cats.length ? (
        <nav className="cats" aria-label={tr("Kategori")}>
          <button type="button" className="cat-tab" data-act="cat" data-id="" aria-pressed={!cat} onClick={() => setCat("")}>{tr("Semua")}</button>
          {cats.map((k) => <button type="button" key={k} className="cat-tab" data-act="cat" data-id={k} aria-pressed={cat === k} onClick={() => setCat(k)}>{k}</button>)}
          {anyOther ? <button type="button" className="cat-tab" data-act="cat" data-id="other" aria-pressed={cat === OTHER} onClick={() => setCat(OTHER)}>{tr("Lainnya")}</button> : null}
        </nav>
      ) : null}
      {subs.length ? (
        <div className="filters subcats" role="group" aria-label={tr("Jenis {cat}", { cat })}>
          <button type="button" className="fchip" data-act="sub" data-id="" aria-pressed={!sub} onClick={() => setSub("")}>{tr("Semua")} {cat}</button>
          {subs.map((k) => <button type="button" key={k} className="fchip" data-act="sub" data-id={k} aria-pressed={sub === k} onClick={() => setSub(k)}>{k}</button>)}
        </div>
      ) : null}

      {rows.map(([k, title, ps]) => (
        <section className="home-row" key={k} data-row={k} aria-label={title}>
          <h2>{title}</h2>
          <div className="row-scroll">
            {ps.map((p, i) => <Card key={p.id} data={data} p={p} eager={false} first={false} onProduct={onProduct} rank={k === "best" ? i + 1 : undefined} />)}
          </div>
        </section>
      ))}

      <section className="toolbar" aria-label={tr("Produk")}>
        <div className="bar-row" style={{ width: "100%" }}>
          <h2>{s ? tr("Hasil “{v}”", { v: query.trim() }) : cat ? (cat === OTHER ? tr("Lainnya") : sub ? `${cat} ${sub}` : cat) : tr("Semua produk")}<span className="count">{list.length} {tr("produk")}</span></h2>
          <select className="sort" value={sort} aria-label={tr("Urutkan")} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map(([k, t]) => <option key={k} value={k}>{tr(t)}</option>)}
          </select>
        </div>
        {sizes.length || anyTier ? (
          <div className="filters" role="group" aria-label={tr("Saring")}>
            <button type="button" className="fchip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{tr("Semua")}</button>
            {anyTier ? <button type="button" className="fchip" aria-pressed={filter === "tier"} onClick={() => setFilter("tier")}>{tr("Harga grosir")}</button> : null}
            {manySizes ? (
              <label className={sizes.includes(filter) ? "fchip fpick on" : "fchip fpick"}>
                <span className="sr">{tr("Ukuran")}</span>
                <select data-act="size-pick" value={sizes.includes(filter) ? filter : ""} onChange={(e) => setFilter(e.target.value || "all")}>
                  <option value="">{tr("Ukuran")}</option>
                  {sizes.map((z) => <option key={z} value={z}>{tr("Ukuran")} {z}</option>)}
                </select>
              </label>
            ) : sizes.map((z) => <button key={z} type="button" className="fchip" aria-pressed={filter === z} onClick={() => setFilter(z)}>{tr("Ukuran")} {z}</button>)}
          </div>
        ) : null}
      </section>

      {list.length ? (
        <div className="catalog">
          {list.map((p, idx) => <Card key={p.id} data={data} p={p} eager={idx < EAGER_CARDS} first={idx === 0 && !rows.length} onProduct={onProduct} />)}
        </div>
      ) : (
        <div className="empty">
          {data.products.length
            ? <><b>{tr("Tidak ada yang cocok.")}</b>{s ? <button className="link" onClick={onClearQuery}>{tr("Hapus pencarian")}</button> : null}{filter !== "all" || cat ? <> <button className="link" onClick={() => { setFilter("all"); setCat(""); }}>{tr("Lihat semua produk")}</button></> : null}</>
            : <><b>{tr("Belum ada baju yang tersedia.")}</b> {tr("Cek lagi nanti.")}</>}
        </div>
      )}

    </>
  );
}

/** The card's badges, most important first: Habis > Terlaris > Baru > Grosir > Sisa > Video, at most CARD_BADGES. */
function badgesOf(p: Product) {
  const out = isSoldOut(p);
  const left = stockOf(p);
  const video = p.variants.flatMap((v) => v.media).some((m) => m.type === "video");
  return [
    out ? <span key="out" className="tag-b out">{tr("Habis")}</span> : null,
    p.bestseller && !out ? <span key="best" className="tag-b best"><Flame />{tr("Terlaris")}</span> : null,
    p.isNew && !out ? <span key="new" className="tag-b new">{tr("Baru")}</span> : null,
    tiersOf(p).length && !out ? <span key="tier" className="tag-b hue">{tr("Grosir")}</span> : null,
    left > 0 && left <= 3 ? <span key="left" className="tag-b warn">{tr("Sisa {n}", { n: left })}</span> : null,
    video ? <span key="video" className="tag-b"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2l7 4-7 4z" /></svg>{tr("Video")}</span> : null,
  ].filter(Boolean).slice(0, CARD_BADGES);
}

/** One product card, in the grid and in the home rows. A sold-out card still opens the product to look at. */
function Card({ data, p, eager, first, onProduct, rank }: { data: StoreData; p: Product; eager: boolean; first: boolean; onProduct: (id: string) => void; rank?: number }) {
  const img = cover(p);
  const out = isSoldOut(p);
  const hint = out ? "" : tierHint(p);
  const swatches = p.variants.length > 1 ? p.variants.slice(0, SWATCHES_MAX) : []; // one variant needs no swatch
  const moreVariants = p.variants.length - swatches.length;
  const sz = sizesOf(data, p);
  return (
    <button className={out ? "cat-card is-out" : "cat-card"} data-act="product" data-id={p.id} data-out={out ? "1" : undefined} onClick={() => onProduct(p.id)}
      aria-label={out ? `${p.name}, ${tr("stok habis")}` : undefined}>
      <div className="cat-img">
        {img ? <img src={img} alt="" width={400} height={500} sizes={rank ? "(min-width:900px) 200px, 42vw" : "(min-width:1280px) 240px, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"}
          loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={first ? "high" : "auto"} /> : <span>{p.name.slice(0, 1)}</span>}
        <div className="cat-badges">{badgesOf(p)}</div>
        {rank ? <span className="rank" aria-label={tr("Peringkat {n}", { n: rank })}>{rank}</span> : null}
      </div>
      <div className="cat-body">
        {p.category ? <div className="cat-kind">{p.subcategory ? `${p.category} · ${p.subcategory}` : p.category}</div> : null}
        <div className="cat-name">{p.name}</div>
        <div className="cat-price money">
          <span className="now">{rp(p.price)}</span>
          {!out && wasPrice(p, p.price) ? <span className="cat-was"><span className="was">{rp(wasPrice(p, p.price))}</span>{strikePct(p) > 0 ? <span className="off">−{strikePct(p)}%</span> : null}</span> : null}
        </div>
        {hint ? <span className="tier-hint">{hint}</span> : null}
        <div className="cat-meta">
          {out ? <span className="out-note">{tr("Stok habis")}</span> : <span className="sz">{sz.map((z) => <i key={z}>{z}</i>)}</span>}
          {swatches.length ? (
            <span className="swatches" aria-label={tr("{n} variasi", { n: p.variants.length })}>
              {swatches.map((v) => { const c = variantCover(v); return c ? <img key={v.id} src={c} alt="" width={18} height={18} loading="lazy" decoding="async" /> : <span key={v.id}>{(v.name || "?").slice(0, 1)}</span>; })}
              {moreVariants > 0 ? <span className="more" aria-hidden="true">+{moreVariants}</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

/** Contact and marketplace links: all of them in the footer's shop card; the hero keeps only WhatsApp (where orders go). */
function shopLinks(data: StoreData) {
  const brand = normBrand(data.brand);
  const wa = data.whatsapp ? data.whatsapp.replace(/\D/g, "") : "";
  return [
    wa ? { k: "wa", href: `https://wa.me/${wa}`, label: tr("WhatsApp"), icon: <Chat /> } : null,
    brand.instagram ? { k: "ig", href: `https://instagram.com/${brand.instagram.replace(/^@/, "")}`, label: brand.instagram, icon: <Cam /> } : null,
    brand.shopee ? { k: "shopee", href: `https://${brand.shopee}`, label: "Shopee", icon: <Bag /> } : null,
    brand.tiktok ? { k: "tiktok", href: `https://${brand.tiktok}`, label: "TikTok Shop", icon: <Note /> } : null,
  ].filter((l) => l !== null);
}

/** How to shop + the shop's card. Rendered below every view and pushed to the bottom of short pages. */
export function ShopFooter({ data }: { data: StoreData }) {
  const brand = normBrand(data.brand);
  const links = shopLinks(data);
  return (
    <footer className="shop-foot">
      <section className="foot-how" aria-labelledby="foot-how-h">
        <h3 id="foot-how-h">{tr("Cara belanja")}</h3>
        <ol className="steps">
          <li><i><Tag /></i><div><b>{tr("Pilih baju")}</b><span>{tr("Pilih variasi dan ukuran, lalu masukkan keranjang.")}</span></div></li>
          <li><i><Bag /></i><div><b>{tr("Ambil atau dikirim")}</b><span>{tr("Isi nama dan WhatsApp, pilih ambil di toko atau dikirim.")}</span></div></li>
          <li><i><Chat /></i><div><b>{tr("Kirim lewat WhatsApp")}</b><span>{tr("Pesan sudah terisi, tinggal tekan kirim.")}</span></div></li>
        </ol>
        <p className="fine">{tr("Harga grosir dihitung dari total pcs di keranjang, boleh campur model. Ongkir dikabari toko lewat WhatsApp.")}</p>
      </section>
      <section className="foot-shop" aria-label={data.shop}>
        <div className="foot-id">
          {brand.logo ? <img className="foot-logo" src={encodeURI(brand.logo)} alt="" width={36} height={36} loading="lazy" decoding="async" /> : null}
          <b>{data.shop}</b>
        </div>
        {brand.address ? <span className="foot-addr"><Pin />{brand.address}</span> : null}
        {links.length ? (
          <div className="foot-links">
            {links.map((l) => <a key={l.k} data-link={l.k} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label}>{l.icon}<span>{l.label}</span></a>)}
          </div>
        ) : null}
        <span className="foot-copy">© {new Date().getFullYear()} {data.shop}</span>
      </section>
    </footer>
  );
}

const Pin = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
const Cam = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" /></svg>;
const Chat = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5z" /></svg>;
const Bag = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
const Note = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.4 2.6 2.2 4.4 5 4.6" /></svg>;
const Share = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3" /><path d="M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
const Pct = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></svg>;
const Stack = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>;
const Flame = () => <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1c.4 2 2.8 3 2.8 5.6A2.8 2.8 0 0 1 6 9.4 2.8 2.8 0 0 1 3.2 6.6C3.2 5 4.4 4.4 4.6 3c.7.6 1 1.3 1 2C6.4 4 6.3 2.4 6 1z" /></svg>;
const Tag = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="7.5" r="1.3" /></svg>;
