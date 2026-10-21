import type { Metadata } from "next";
import { getStore, posUrl, type StoreResult } from "@/lib/pos";
import { Mark } from "./Mark";
import { Storefront } from "./Storefront";

export async function storeMetadata(r: StoreResult): Promise<Metadata> {
  if (!r.ok) return { title: "Toko tidak ditemukan" };
  return { title: r.data.shop, description: r.data.intro || `Belanja di ${r.data.shop}. Pesan langsung lewat WhatsApp.` };
}

/** One shop's storefront, or a friendly message when it cannot be opened. */
export async function Shop({ slug, result }: { slug?: string; result?: StoreResult }) {
  const r = result ?? (slug ? await getStore(slug) : ({ ok: false, status: 404 } as const));
  if (!r.ok) {
    return (
      <main className="wrap state">
        <section className="panel" style={{ maxWidth: 420, width: "100%" }}>
          <div className="panel-b" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <Mark />
            <h1 style={{ fontSize: 22 }}>{r.status === 404 ? "Toko tidak ditemukan" : "Toko sedang tidak bisa dibuka"}</h1>
            <p className="muted" style={{ margin: 0 }}>{r.status === 404 ? "Cek lagi link tokonya, atau mungkin tokonya sedang tutup." : "Coba muat ulang sebentar lagi."}</p>
          </div>
        </section>
      </main>
    );
  }
  return (
    <>
      <header className="top" id="top">
        <span id="brand-mark" className="brand-mark"><Mark /></span>
        <div className="brand"><span id="brand-name">{r.data.shop}</span><small id="shop-sub">Toko online</small></div>
        <div className="sp" />
        <button type="button" className="icon-btn cart-btn" data-act="cart" aria-label="Keranjang" id="cart-btn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></svg>
        </button>
      </header>
      <main className="wrap" id="main" aria-live="polite" />
      <div id="sheet-root" />
      <div id="toast-root" />
      <Storefront data={r.data} api={posUrl()} />
    </>
  );
}
