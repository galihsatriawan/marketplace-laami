import type { StoreData } from "@/lib/pos";
import { cover, hasVariants, normBrand, rp, sizeEntries, tierHint } from "@/lib/store";

type Props = { data: StoreData; query: string; onQuery: (q: string) => void; onProduct: (id: string) => void };

export function Catalog({ data, query, onQuery, onProduct }: Props) {
  const s = query.toLowerCase();
  const brand = normBrand(data.brand);
  const list = data.products.filter((p) => !s || p.name.toLowerCase().includes(s));
  const meta = [brand.address, brand.instagram && `IG ${brand.instagram}`].filter(Boolean);
  return (
    <>
      <section className="panel">
        <div className="store-intro">
          <h1 style={{ fontSize: "var(--fs-title)", lineHeight: "34px", letterSpacing: "-.02em" }}>{data.shop}</h1>
          {data.intro ? <p style={{ margin: 0 }}>{data.intro}</p> : null}
          {meta.length ? <div className="small muted">{meta.map((x, i) => <span key={i}>{x}</span>)}</div> : null}
          <div className="small muted">Pilih baju, masukkan keranjang, lalu kirim pesanan lewat WhatsApp.</div>
        </div>
      </section>
      {data.products.length > 4 ? (
        <input className="in" type="search" id="cat-q" placeholder="Cari baju" value={query} data-input="q" aria-label="Cari baju"
          onChange={(e) => onQuery(e.target.value)} />
      ) : null}
      {list.length ? (
        <div className="catalog">
          {list.map((p) => {
            const variants = hasVariants(p) ? p.variants.length : 0;
            const video = p.variants.flatMap((v) => v.media).some((m) => m.type === "video");
            const sizes = [...new Set(p.variants.flatMap((v) => sizeEntries(data, v.stock).map(([k]) => k)))];
            const img = cover(p);
            const hint = tierHint(p);
            return (
              <button key={p.id} className="cat-card" data-act="product" data-id={p.id} onClick={() => onProduct(p.id)}>
                <div className="cat-img">
                  {img ? <img src={img} alt="" loading="lazy" /> : <span>{p.name.slice(0, 1)}</span>}
                  {video ? <span className="pill neu media-badge">Video</span> : null}
                </div>
                <div className="cat-body">
                  <div className="cat-name">{p.name}</div>
                  <div className="cat-price money">{rp(p.price)}</div>
                  {hint ? <span className="tier-hint">{hint}</span> : null}
                  <div className="small muted">{variants > 1 ? `${variants} variasi · ` : ""}{sizes.join(", ")}</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <div className="empty">
            {data.products.length ? "Tidak ada yang cocok." : <><b>Belum ada baju yang tersedia.</b> Cek lagi nanti.</>}
          </div>
        </section>
      )}
      <div className="foot">{data.shop}</div>
    </>
  );
}
