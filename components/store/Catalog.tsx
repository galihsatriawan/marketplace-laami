import { useState } from "react";
import type { StoreData } from "@/lib/pos";
import { cover, hasVariants, normBrand, num, rp, sizeEntries, tierHint, tiersOf, variantCover, type Product } from "@/lib/store";

type Sort = "rec" | "low" | "high" | "name";
/** via: name of the reseller whose link the buyer came through. */
type Props = { data: StoreData; query: string; via?: string; onProduct: (id: string) => void; onClearQuery: () => void };

const SORTS: [Sort, string][] = [["rec", "Rekomendasi"], ["low", "Harga terendah"], ["high", "Harga tertinggi"], ["name", "Nama A–Z"]];
const stockOf = (p: Product) => p.variants.reduce((a, v) => a + Object.values(v.stock).reduce((b, n) => b + num(n), 0), 0);
const sizesOf = (d: StoreData, p: Product) =>
  [...new Set(p.variants.flatMap((v) => sizeEntries(d, v.stock).filter(([, n]) => num(n) > 0).map(([k]) => k)))];

export function Catalog({ data, query, via, onProduct, onClearQuery }: Props) {
  const [filter, setFilter] = useState<string>("all"); // "all", "tier" or a size
  const [sort, setSort] = useState<Sort>("rec");
  const brand = normBrand(data.brand);
  const s = query.trim().toLowerCase();

  // Size filters only list sizes some product still has.
  const sizes = (data.sizes || []).filter((z) => data.products.some((p) => sizesOf(data, p).includes(z)));
  const anyTier = data.products.some((p) => tiersOf(p).length);
  const list = data.products
    .filter((p) => !s || p.name.toLowerCase().includes(s))
    .filter((p) => filter === "all" || (filter === "tier" ? tiersOf(p).length > 0 : sizesOf(data, p).includes(filter)));
  if (sort === "low") list.sort((a, b) => a.price - b.price);
  else if (sort === "high") list.sort((a, b) => b.price - a.price);
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "id"));

  // The lowest wholesale step across the shop, for the promo card.
  const best = data.products.flatMap((p) => tiersOf(p)).sort((a, b) => a.min - b.min || a.price - b.price)[0];
  const wa = data.whatsapp ? data.whatsapp.replace(/\D/g, "") : "";

  return (
    <>
      <section className="hero-band">
        <div className="hero-txt">
          <span className="eyebrow">Toko online resmi</span>
          <h1>{data.shop}</h1>
          {data.intro ? <p>{data.intro}</p> : <p>Pilih baju, masukkan keranjang, lalu kirim pesanan lewat WhatsApp.</p>}
          <div className="hero-meta">
            {via ? <span id="via-ref"><Chat />Dibantu {via}</span> : null}
            {brand.address ? <span><Pin />{brand.address}</span> : null}
            {brand.instagram ? <a href={`https://instagram.com/${brand.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"><Cam />{brand.instagram}</a> : null}
            {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><Chat />WhatsApp</a> : null}
          </div>
        </div>
        {best ? (
          <div className="promo">
            <span className="k">Grosir campur model</span>
            <b>Beli {best.min}+ pcs mulai {rp(best.price)}</b>
            <span>Dihitung dari total keranjang, boleh beda model dan ukuran.</span>
          </div>
        ) : null}
      </section>

      <section className="toolbar" aria-label="Produk">
        <div className="bar-row" style={{ width: "100%" }}>
          <h2>{s ? `Hasil “${query.trim()}”` : "Semua produk"}<span className="count">{list.length} produk</span></h2>
          <select className="sort" value={sort} aria-label="Urutkan" onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        {sizes.length || anyTier ? (
          <div className="filters" role="group" aria-label="Saring">
            <button type="button" className="fchip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Semua</button>
            {anyTier ? <button type="button" className="fchip" aria-pressed={filter === "tier"} onClick={() => setFilter("tier")}>Harga grosir</button> : null}
            {sizes.map((z) => <button key={z} type="button" className="fchip" aria-pressed={filter === z} onClick={() => setFilter(z)}>Ukuran {z}</button>)}
          </div>
        ) : null}
      </section>

      {list.length ? (
        <div className="catalog">
          {list.map((p) => {
            const video = p.variants.flatMap((v) => v.media).some((m) => m.type === "video");
            const img = cover(p);
            const hint = tierHint(p);
            const left = stockOf(p);
            const swatches = hasVariants(p) ? p.variants.slice(0, 4) : [];
            return (
              <button key={p.id} className="cat-card" data-act="product" data-id={p.id} onClick={() => onProduct(p.id)}>
                <div className="cat-img">
                  {img ? <img src={img} alt="" loading="lazy" /> : <span>{p.name.slice(0, 1)}</span>}
                  <div className="cat-badges">
                    {tiersOf(p).length ? <span className="tag-b hue">Grosir</span> : null}
                    {video ? <span className="tag-b"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2l7 4-7 4z" /></svg>Video</span> : null}
                    {left > 0 && left <= 3 ? <span className="tag-b warn">Sisa {left}</span> : null}
                  </div>
                </div>
                <div className="cat-body">
                  <div className="cat-name">{p.name}</div>
                  <div className="cat-price money">{rp(p.price)}</div>
                  {hint ? <span className="tier-hint">{hint}</span> : null}
                  <div className="cat-meta">
                    <span className="sz">{sizesOf(data, p).join(" · ")}</span>
                    {swatches.length ? (
                      <span className="swatches" aria-label={`${p.variants.length} variasi`}>
                        {swatches.map((v) => { const c = variantCover(v); return c ? <img key={v.id} src={c} alt="" /> : <span key={v.id}>{(v.name || "?").slice(0, 1)}</span>; })}
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
            ? <><b>Tidak ada yang cocok.</b>{s ? <button className="link" onClick={onClearQuery}>Hapus pencarian</button> : null}{filter !== "all" ? <> <button className="link" onClick={() => setFilter("all")}>Lihat semua produk</button></> : null}</>
            : <><b>Belum ada baju yang tersedia.</b> Cek lagi nanti.</>}
        </div>
      )}

      <footer className="shop-foot">
        <div>
          <h3>Cara belanja</h3>
          <ol className="steps">
            <li><i><Tag /></i><div><b>Pilih baju</b>Variasi dan ukuran, lalu masukkan keranjang. Beli banyak dapat harga grosir.</div></li>
            <li><i><Bag /></i><div><b>Ambil atau dikirim</b>Isi nama dan nomor WhatsApp, pilih diambil di toko atau dikirim.</div></li>
            <li><i><Chat /></i><div><b>Pesan lewat WhatsApp</b>Pesan sudah terisi, tinggal tekan kirim ke penjual.</div></li>
          </ol>
        </div>
        <div>
          <h3>{data.shop}</h3>
          {brand.address ? <div>{brand.address}</div> : null}
          {brand.instagram ? <div>Instagram {brand.instagram}</div> : null}
          <div className="fine">Harga grosir dihitung dari total pcs di keranjang. Ongkir dikabari toko lewat WhatsApp.</div>
        </div>
      </footer>
    </>
  );
}

const Pin = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
const Cam = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" /></svg>;
const Chat = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5z" /></svg>;
const Bag = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
const Tag = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="7.5" r="1.3" /></svg>;
