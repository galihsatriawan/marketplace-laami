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
  return <Storefront data={r.data} api={posUrl()} />;
}
