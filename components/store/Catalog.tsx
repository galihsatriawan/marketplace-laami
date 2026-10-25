import type { StoreData } from "@/lib/pos";
import { cover, normBrand, num, promoTerms, promoTitle, rp, sizeEntries, strikePct, tierHint, tiersOf, variantCover, wasPrice, type Browse, type Product, type Sort } from "@/lib/store";
import { tr } from "@/lib/i18n";

/** via: name of the reseller whose link the buyer came through. browse: category / sort / filter, owned by the
 *  storefront so they survive a visit to the cart. */
type Props = { data: StoreData; query: string; via?: string; onProduct: (id: string) => void; onClearQuery: () => void;
  browse: Browse; onBrowse: (patch: Partial<Browse>) => void };

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

export function Catalog({ data, query, via, onProduct, onClearQuery, browse, onBrowse }: Props) {
  // filter: "all", "tier" or a size; cat: "" = all, OTHER = products without a category; sub: within cat, "" = all of cat
  const { filter, sort, cat, sub } = browse;
  const setFilter = (f: string) => onBrowse({ filter: f });
  const setSort = (v: Sort) => onBrowse({ sort: v });
  const setSub = (k: string) => onBrowse({ sub: k });
  const setCat = (k: string) => onBrowse({ cat: k, sub: "" });
  const brand = normBrand(data.brand);
  const s = query.trim().toLowerCase();

  // Size filters only list sizes some product still has.
  const sizes = (data.sizes || []).filter((z) => data.products.some((p) => sizesOf(data, p).includes(z)));
  const anyTier = data.products.some((p) => tiersOf(p).length);
  const cats = data.categories?.length ? data.categories : [...new Set(data.products.map((p) => p.category || "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
  const anyOther = cats.length > 0 && data.products.some((p) => !p.category);
  const subs = cat && cat !== OTHER ? data.subcategories?.[cat] || [] : [];
  const inCat = (p: Product) => !cat || (cat === OTHER ? !p.category : p.category === cat && (!sub || p.subcategory === sub));
  const list = data.products
    .filter(inCat)
    .filter((p) => !s || `${p.name} ${p.category || ""} ${p.subcategory || ""}`.toLowerCase().includes(s))
    .filter((p) => filter === "all" || (filter === "tier" ? tiersOf(p).length > 0 : sizesOf(data, p).includes(filter)));
  if (sort === "low") list.sort((a, b) => a.price - b.price);
  else if (sort === "high") list.sort((a, b) => b.price - a.price);
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "id"));

  // The lowest wholesale step across the shop, for the promo card.
  const best = data.products.flatMap((p) => tiersOf(p)).sort((a, b) => a.min - b.min || a.price - b.price)[0];
  const links = shopLinks(data);
  // Up to three in-stock products with a photo, shown as a small collage that opens the product.
  const shots = data.products.filter((p) => cover(p) && stockOf(p) > 0).slice(0, 3);
  const heroWa = links.find((l) => l.k === "wa");
  const manySizes = sizes.length > SIZE_CHIPS_MAX;
  // A single photo is hidden below 900px (see globals.css), so it only gets the two-column hero from there up.
  const heroCls = ["hero-band", shots.length > 1 ? "has-shots" : shots.length === 1 ? "has-shot1" : ""].filter(Boolean).join(" ");

  return (
    <>
      <section className={heroCls}>
        <div className="hero-txt">
          {via ? <span className="hero-via" id="via-ref"><Chat />{tr("Dibantu")} {via}</span> : null}
          <h1>{data.shop}</h1>
          {data.intro ? <p>{data.intro}</p> : <p>{tr("Pilih baju, masukkan keranjang, lalu kirim pesanan lewat WhatsApp.")}</p>}
          {brand.address ? <span className="hero-addr"><Pin />{brand.address}</span> : null}
          {heroWa ? (
            <div className="hero-links">
              <a className="hl hl-main" data-link="wa" href={heroWa.href} target="_blank" rel="noopener noreferrer">{heroWa.icon}{tr("Chat WhatsApp")}</a>
            </div>
          ) : null}
        </div>
        {shots.length ? (
          <div className={`hero-shots n${shots.length}`}>
            {shots.map((p, i) => (
              <button type="button" key={p.id} className={`shot s${i}`} data-act="product" data-id={p.id} aria-label={p.name} onClick={() => onProduct(p.id)}>
                <img src={cover(p)} alt="" loading={i ? "lazy" : "eager"} decoding="async" fetchPriority={i ? "auto" : "high"} />
              </button>
            ))}
          </div>
        ) : null}
        {best || data.promos?.length ? (
          <div className="promos">
            {(data.promos || []).slice(0, 2).map((p, i) => (
              <div className="promo promo-deal" key={i}>
                <span className="k">{p.name}</span>
                <b>{promoTitle(p)}</b>
                <span>{promoTerms(p) || tr("Otomatis terpotong di keranjang.")}</span>
              </div>
            ))}
            {best ? (
              <div className="promo">
                <span className="k">{tr("Grosir campur model")}</span>
                <b>{tr("Beli {min}+ pcs mulai", { min: best.min })} {rp(best.price)}</b>
                <span>{tr("Dihitung dari total keranjang, boleh beda model dan ukuran.")}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

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
          {list.map((p, idx) => {
            const video = p.variants.flatMap((v) => v.media).some((m) => m.type === "video");
            const img = cover(p);
            const hint = tierHint(p);
            const left = stockOf(p);
            const swatches = p.variants.length > 1 ? p.variants.slice(0, SWATCHES_MAX) : []; // one variant needs no swatch
            const moreVariants = p.variants.length - swatches.length;
            const eager = idx < EAGER_CARDS;
            return (
              <button key={p.id} className="cat-card" data-act="product" data-id={p.id} onClick={() => onProduct(p.id)}>
                <div className="cat-img">
                  {img ? <img src={img} alt="" width={400} height={500} sizes="(min-width:1280px) 240px, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                    loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={idx === 0 ? "high" : "auto"} /> : <span>{p.name.slice(0, 1)}</span>}
                  <div className="cat-badges">
                    {tiersOf(p).length ? <span className="tag-b hue">{tr("Grosir")}</span> : null}
                    {video ? <span className="tag-b"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2l7 4-7 4z" /></svg>{tr("Video")}</span> : null}
                    {left > 0 && left <= 3 ? <span className="tag-b warn">{tr("Sisa")} {left}</span> : null}
                  </div>
                </div>
                <div className="cat-body">
                  {p.category ? <div className="cat-kind">{p.subcategory ? `${p.category} · ${p.subcategory}` : p.category}</div> : null}
                  <div className="cat-name">{p.name}</div>
                  <div className="cat-price money">
                    <span className="now">{rp(p.price)}</span>
                    {wasPrice(p, p.price) ? <span className="cat-was"><span className="was">{rp(wasPrice(p, p.price))}</span>{strikePct(p) > 0 ? <span className="off">−{strikePct(p)}%</span> : null}</span> : null}
                  </div>
                  {hint ? <span className="tier-hint">{hint}</span> : null}
                  <div className="cat-meta">
                    <span className="sz">{sizesOf(data, p).map((z) => <i key={z}>{z}</i>)}</span>
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
          })}
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
const Tag = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="7.5" r="1.3" /></svg>;
