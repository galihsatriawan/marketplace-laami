import { useState } from "react";
import type { StorePayment } from "@/lib/pos";
import { rp, type DoneOrder } from "@/lib/store";
import { tr } from "@/lib/i18n";
import { fmtEtd } from "./Shipping";
import { ReturnsLink } from "./Steps";

type Props = {
  order: DoneOrder; shop: string; whatsapp: string; payment: StorePayment | null;
  onNew: () => void;
  /** The buyer tapped through to WhatsApp (the order no longer needs to come back on reload). */
  onWa: () => void;
  onToast: (msg: string) => void;
  /** Open a picture (the QRIS) in the zoomable viewer. */
  onZoom: (url: string) => void;
  /** Opens "Cara retur / tukar"; absent when the shop wrote none. */
  onReturns?: () => void;
};

/** Copies text; true when it worked (older browsers and http pages fall back to a hidden textarea). */
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch { return false; }
}

const CopyIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></svg>;
const CheckIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

/** A copy button that says "Disalin" for a moment after a tap. */
function CopyBtn({ text, label, what, onToast, id }: { text: string; label: string; what: string; onToast: (m: string) => void; id?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={done ? "copy-btn ok" : "copy-btn"} data-act="copy" id={id} aria-label={tr("Salin {what}", { what: label })}
      onClick={async () => {
        const ok = await copyText(text.replace(/[\s-]/g, (c) => (what === "number" ? "" : c)));
        if (ok) { setDone(true); setTimeout(() => setDone(false), 1600); onToast(tr("{what} disalin", { what: label })); }
        else onToast(text);
      }}>
      {done ? <CheckIcon /> : <CopyIcon />}<span>{done ? tr("Disalin") : tr("Salin")}</span>
    </button>
  );
}

/** "0812…" as the shop's WhatsApp number reads locally. */
const localPhone = (wa: string) => { const d = wa.replace(/\D/g, ""); return d.startsWith("62") ? "0" + d.slice(2) : d; };

/** How to pay: bank accounts and e-wallets with copy buttons, the QRIS picture, the shop's note. */
function PayInfo({ payment, total, shipped, onToast, onZoom }: { payment: StorePayment; total: number; shipped: boolean; onToast: (m: string) => void; onZoom: (url: string) => void }) {
  const rows = [
    ...payment.banks.map((b) => ({ k: `b-${b.bank}-${b.number}`, name: b.bank, number: b.number, holder: b.holder, kind: tr("Transfer bank") })),
    ...payment.wallets.map((w) => ({ k: `w-${w.wallet}-${w.number}`, name: w.wallet, number: w.number, holder: w.holder, kind: tr("E-wallet") })),
  ];
  if (!rows.length && !payment.qris && !payment.note) return null;
  return (
    <section className="pay" aria-labelledby="pay-h" id="pay">
      <div className="pay-h">
        <h2 id="pay-h">{tr("Cara bayar")}</h2>
        <span className="pay-amt">{tr("Total {total}", { total: rp(total) })}{shipped ? null : <span className="muted"> · {tr("+ ongkir bila dikirim")}</span>}</span>
      </div>
      {rows.length ? (
        <ul className="pay-list">
          {rows.map((r) => (
            <li key={r.k} className="pay-row">
              <span className="pay-logo" aria-hidden="true">{r.name.slice(0, 4).toUpperCase()}</span>
              <div className="pay-txt">
                <span className="pay-name">{r.name}<span className="pay-kind"> · {r.kind}</span></span>
                <b className="pay-no money">{r.number}</b>
                {r.holder ? <span className="pay-holder">{tr("a.n. {name}", { name: r.holder })}</span> : null}
              </div>
              <CopyBtn text={r.number} what="number" label={tr("Nomor {name}", { name: r.name })} onToast={onToast} />
            </li>
          ))}
        </ul>
      ) : null}
      {payment.qris ? (
        <div className="qris">
          <button type="button" className="qris-img" data-act="qris-zoom" aria-label={tr("Perbesar QRIS")} onClick={() => onZoom(payment.qris!)}>
            <img src={payment.qris} alt={tr("Kode QRIS toko")} width={180} height={180} loading="lazy" decoding="async" />
          </button>
          <div className="qris-txt">
            <b>{tr("QRIS")}</b>
            <span>{tr("Scan dari aplikasi bank atau e-wallet apa saja.")}</span>
            <div className="qris-acts">
              <button type="button" className="btn sm" data-act="qris-zoom" onClick={() => onZoom(payment.qris!)}>{tr("Perbesar")}</button>
              <a className="btn sm" data-act="qris-save" href={payment.qris} download target="_blank" rel="noopener noreferrer">{tr("Simpan gambar")}</a>
            </div>
          </div>
        </div>
      ) : null}
      {payment.note ? <p className="pay-note">{payment.note}</p> : null}
    </section>
  );
}

/** After checkout: the order is recorded; the buyer still has to send the WhatsApp message, then pay. */
export function Done({ order, shop, whatsapp, payment, onNew, onWa, onToast, onZoom, onReturns }: Props) {
  const items = order.items || [];
  const shown = items.slice(0, 4);
  const more = items.length - shown.length;
  const wa = localPhone(whatsapp);
  const sh = order.shipping;
  const hasPay = !!payment && !!(payment.banks.length || payment.wallets.length || payment.qris || payment.note);
  return (
    <div className="done-wrap">
      <section className="panel done">
        <div className="panel-b">
          <span className="done-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
          <h1 className="done-title">{tr("Pesanan tercatat")}</h1>
          <p className="done-sub muted">{tr("Tinggal satu langkah: kirim pesanannya ke WhatsApp {shop}.", { shop })}</p>
          <div className="done-codebox">
            <div><div className="small muted">{tr("Kode pesanan")}</div><div className="done-code" id="done-code">{order.code}</div></div>
            <CopyBtn text={order.code} what="code" label={tr("Kode pesanan")} onToast={onToast} id="done-copy" />
          </div>
          {shown.length ? (
            <ul className="done-items">
              {shown.map((it, i) => (
                <li key={i}><span className="di-n">{it.name}<span className="muted">{it.variant ? ` · ${it.variant}` : ""} · {it.size}</span></span><span className="di-q money">{it.qty} × {rp(it.price)}</span></li>
              ))}
              {more > 0 ? <li className="muted">{tr("+{n} barang lagi", { n: more })}</li> : null}
            </ul>
          ) : null}
          <div className="calc">
            {order.promo || sh ? <>
              {order.subtotal ? <div className="ln"><span className="k">{tr("Subtotal")}</span><span className="money">{rp(order.subtotal)}</span></div> : null}
              {order.promo ? <div className="ln promo-ln"><span className="k">{tr("Promo {name}", { name: order.promo.name })}</span><span className="money">−{rp(order.promo.amount)}</span></div> : null}
            </> : null}
            {sh ? (
              <div className="ln" id="done-ongkir">
                <span className="k">{tr("Ongkir")} <span className="ln-sub">{[`${sh.courierName || (sh.courier || "").toUpperCase()} ${sh.service || ""}`.trim(), fmtEtd(sh.etd)].filter(Boolean).join(" · ")}{sh.destinationLabel ? <>{sh.courier ? <br /> : null}{tr("ke {label}", { label: sh.destinationLabel })}</> : null}</span></span>
                <span className={sh.cost === 0 ? "money free" : "money"}>{sh.cost === 0 ? (sh.free && sh.freeArea ? tr("Gratis (area {area})", { area: sh.freeArea }) : tr("Gratis")) : rp(sh.cost)}</span>
              </div>
            ) : null}
            <div className="ln tot"><span>{tr("Total")} <span className="small muted" style={{ fontWeight: 500 }}>{order.pcs} {tr("pcs")}{order.tier ? tr(" · harga grosir") : ""}</span></span><span className="money">{rp(order.total)}</span></div>
          </div>
          <ol className="next-steps">
            <li><b>{tr("Kirim pesan WhatsApp yang sudah terisi")}</b><span>{tr("Pesanan baru diproses setelah pesannya sampai ke toko.")}</span></li>
            {sh ? <li><b>{tr("Tunggu konfirmasi toko")}</b><span>{tr("Toko mengecek pesanan dan membalas dengan total akhir.")}</span></li>
              : <li><b>{tr("Tunggu konfirmasi ongkir")}</b><span>{tr("Toko membalas dengan total akhir (kalau dikirim, plus ongkir).")}</span></li>}
            <li><b>{hasPay ? tr("Transfer & kirim bukti") : tr("Bayar sesuai info dari toko")}</b><span>{hasPay ? tr("Pakai salah satu cara bayar di bawah, lalu kirim fotonya di chat yang sama.") : tr("Toko mengabari cara bayarnya lewat WhatsApp.")}</span></li>
          </ol>
          <a className="btn lg full wa-btn" id="wa-link" href={order.waUrl} rel="noopener" onClick={onWa}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /></svg>{tr("Buka WhatsApp")}
          </a>
          {wa ? (
            <p className="wa-fallback small muted">{tr("WhatsApp tidak terbuka?")} <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" data-act="wa-direct">{tr("Chat {wa}", { wa })}</a>
              {" "}{tr("dan sebut kode {code}.", { code: order.code })}</p>
          ) : null}
        </div>
      </section>
      {hasPay ? <section className="panel done-pay"><div className="panel-b"><PayInfo payment={payment!} total={order.total} shipped={!!sh} onToast={onToast} onZoom={onZoom} /></div></section> : null}
      {onReturns ? <div className="done-ret"><ReturnsLink onOpen={onReturns}>{tr("Kebijakan retur / tukar")}</ReturnsLink></div> : null}
      <button className="btn full done-new" data-act="new-order" onClick={onNew}>{tr("Belanja lagi")}</button>
    </div>
  );
}
