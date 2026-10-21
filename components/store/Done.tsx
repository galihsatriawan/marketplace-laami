import { rp, type DoneOrder } from "@/lib/store";

export function Done({ order, shop, onNew }: { order: DoneOrder; shop: string; onNew: () => void }) {
  return (
    <section className="panel">
      <div className="panel-b" style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 24 }}>
        <span className="pill pos" style={{ alignSelf: "flex-start" }}>Pesanan tercatat</span>
        <div><div className="small muted">Kode pesanan</div><div className="done-code" id="done-code">{order.code}</div></div>
        <div className="calc"><div className="ln"><span className="k">{order.pcs} pcs{order.tier ? " · harga grosir" : ""}</span><span className="money">{rp(order.total)}</span></div></div>
        <p style={{ margin: 0 }}>Satu langkah lagi: kirim pesanannya ke WhatsApp {shop}. Kalau WhatsApp belum terbuka, tekan tombol di bawah.</p>
        <a className="btn full wa-btn" id="wa-link" href={order.waUrl} rel="noopener">Buka WhatsApp &amp; kirim pesanan</a>
        <button className="btn full" data-act="new-order" onClick={onNew}>Belanja lagi</button>
      </div>
    </section>
  );
}
