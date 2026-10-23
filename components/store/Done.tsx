import { rp, type DoneOrder } from "@/lib/store";
import { tr } from "@/lib/i18n";

export function Done({ order, shop, onNew }: { order: DoneOrder; shop: string; onNew: () => void }) {
  return (
    <section className="panel done">
      <div className="panel-b">
        <span className="done-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>{tr("Pesanan tercatat")}</h1>
        <div><div className="small muted">{tr("Kode pesanan")}</div><div className="done-code" id="done-code">{order.code}</div></div>
        <div className="calc" style={{ textAlign: "left" }}><div className="ln"><span className="k">{order.pcs} {tr("pcs")}{order.tier ? tr(" · harga grosir") : ""}</span><span className="money">{rp(order.total)}</span></div></div>
        <p style={{ margin: 0 }} className="muted">{tr("Satu langkah lagi: kirim pesanannya ke WhatsApp {shop}. Kalau WhatsApp belum terbuka, tekan tombol di bawah.", { shop })}</p>
        <a className="btn lg full wa-btn" id="wa-link" href={order.waUrl} rel="noopener">{tr("Buka WhatsApp & kirim pesanan")}</a>
        <button className="btn full" data-act="new-order" onClick={onNew}>{tr("Belanja lagi")}</button>
      </div>
    </section>
  );
}
