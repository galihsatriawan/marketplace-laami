// Checkout shipping when the shop prices it live (RajaOngkir through the POS): pick the destination
// (kecamatan / kelurahan search), then a courier service. Any failure falls back to "Ongkir dikabari toko".
import { useEffect, useRef, useState } from "react";
import type { Destination, ShipOption, ShipQuote } from "@/lib/pos";
import { FETCH_TIMEOUT_MS, rp } from "@/lib/store";
import { tr } from "@/lib/i18n";
import { Truck } from "./Steps";

export type ShipPick = { courier: string; service: string };
/** The search needs this many letters before it asks the shop. */
export const DEST_MIN = 3;
const DEST_DEBOUNCE_MS = 350;

/** "2-3 day" / "2-3 HARI" / "1" → "2-3 hari"; "" when the courier gives none. */
export function fmtEtd(etd: string | undefined) {
  const t = String(etd || "").replace(/\s*(days?|hari)\s*$/i, "").trim();
  return t ? tr("{etd} hari", { etd: t }) : "";
}
export const sameOpt = (a: ShipPick | null, b: ShipOption) => !!a && a.courier === b.courier && a.service === b.service;
/** What the buyer pays for this option: 0 when the order ships free. */
export const optCost = (q: ShipQuote, o: ShipOption) => (q.free ? 0 : o.cost);
/** Cheapest first; the shop's own order breaks ties. */
export const sortOpts = (os: ShipOption[]) => [...os].filter((o) => o && o.courier && o.service).sort((a, b) => a.cost - b.cost);

type Props = {
  api: string; slug: string;
  dest: Destination | null; onDest: (d: Destination | null) => void;
  quote: ShipQuote | null; loading: boolean;
  pick: ShipPick | null; onPick: (p: ShipPick) => void;
  /** The shop's shipping prices cannot be reached: the reason (shown) and the order goes without shipping. */
  onDown: (msg: string) => void;
  err?: { dest?: string; courier?: string };
  destRef?: React.RefObject<HTMLInputElement | null>;
  optsRef?: React.RefObject<HTMLDivElement | null>;
};

export function ShipBox({ api, slug, dest, onDest, quote, loading, pick, onPick, onDown, err, destRef, optsRef }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Destination[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(!dest);
  const listId = "co-dest-list";
  const onDownRef = useRef(onDown);
  onDownRef.current = onDown;

  useEffect(() => {
    const s = q.trim();
    if (s.length < DEST_MIN) { setResults(null); setSearching(false); return; }
    const ac = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${api}/api/public/stores/${slug}/shipping/destinations?q=${encodeURIComponent(s)}`,
          { signal: AbortSignal.any ? AbortSignal.any([ac.signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]) : ac.signal, cache: "no-store" });
        if (r.status === 429) { setResults([]); setSearching(false); return; }
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { results?: Destination[] };
        setResults(Array.isArray(j.results) ? j.results.slice(0, 20) : []);
        setSearching(false);
      } catch (e) {
        if (ac.signal.aborted) return;
        setSearching(false);
        onDownRef.current((e as Error)?.name === "TimeoutError" ? tr("Cek ongkir sedang lambat.") : tr("Cek ongkir sedang tidak bisa dipakai."));
      }
    }, DEST_DEBOUNCE_MS);
    return () => { ac.abort(); clearTimeout(t); };
  }, [q, api, slug]);

  const choose = (d: Destination) => { onDest(d); setOpen(false); setQ(""); setResults(null); };
  const opts = quote ? sortOpts(quote.options) : [];

  return (
    <div className="ship-box" id="co-ship">
      <div className="f"><label htmlFor="co-dest">{tr("Kecamatan / kelurahan tujuan")}</label>
        {dest && !open ? (
          <div className="dest-pick" id="co-dest-picked">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            <span className="dest-l">{dest.label}{dest.free ? <span className="free-tag">{tr("Gratis ongkir")}</span> : null}</span>
            <button type="button" className="btn sm ghost" data-act="dest-change" onClick={() => { setOpen(true); requestAnimationFrame(() => destRef?.current?.focus()); }}>{tr("Ganti")}</button>
          </div>
        ) : (
          <div className="dest-search">
            <input ref={destRef} className="in" id="co-dest" type="search" autoComplete="off" enterKeyHint="search" value={q} maxLength={60}
              placeholder={tr("Ketik nama kecamatan atau kelurahan")} role="combobox" aria-expanded={!!results?.length} aria-controls={listId} aria-autocomplete="list"
              aria-invalid={err?.dest ? true : undefined} aria-describedby={err?.dest ? "co-dest-err" : "co-dest-hint"}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (results?.length) choose(results[0]); } if (e.key === "Escape" && dest) { e.stopPropagation(); setOpen(false); } }} />
            {err?.dest ? <span className="f-err" id="co-dest-err" role="alert">{err.dest}</span>
              : <span className="hint" id="co-dest-hint">{searching ? tr("Mencari…") : q.trim().length < DEST_MIN ? tr("Minimal {n} huruf, contoh: Sumberpucung", { n: DEST_MIN }) : results && !results.length ? tr("Tidak ketemu. Coba nama kecamatan lain.") : tr("Pilih salah satu di bawah.")}</span>}
            {results?.length ? (
              <ul className="dest-list" id={listId} role="listbox" aria-label={tr("Hasil pencarian tujuan")}>
                {results.map((d) => (
                  <li key={String(d.id)} role="option" aria-selected={dest?.id === d.id}>
                    <button type="button" data-act="dest" data-id={String(d.id)} onClick={() => choose(d)}>
                      <span className="dest-l">{d.label}</span>
                      {d.free ? <span className="free-tag">{tr("Gratis ongkir")}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {dest ? <button type="button" className="link small" data-act="dest-keep" onClick={() => setOpen(false)}>{tr("Tetap ke {label}", { label: dest.label })}</button> : null}
          </div>
        )}
      </div>
      {dest && !open ? (
        <div className="f" ref={optsRef} tabIndex={-1}><span className="lbl" id="co-courier-l">{tr("Kurir")}</span>
          {quote?.free ? <div className="ship-free" id="co-ship-free"><Truck /><span>{tr("Gratis ongkir area {area}", { area: quote.freeArea || "" })}</span></div>
            : quote?.freeArea && quote.minSpendLeft ? <div className="ship-free soon"><Truck /><span>{tr("Belanja {rp} lagi untuk gratis ongkir area {area}", { rp: rp(quote.minSpendLeft), area: quote.freeArea })}</span></div> : null}
          {loading && !opts.length ? <div className="ship-load" role="status">{tr("Menghitung ongkir…")}</div>
            : !opts.length ? <div className="ship-load">{tr("Belum ada kurir ke tujuan ini. Ongkir dikabari toko lewat WhatsApp.")}</div> : (
            <div className={loading ? "ship-opts busy" : "ship-opts"} role="radiogroup" aria-labelledby="co-courier-l" aria-invalid={err?.courier ? true : undefined} aria-describedby={err?.courier ? "co-courier-err" : undefined}>
              {opts.map((o) => {
                const on = sameOpt(pick, o), c = optCost(quote!, o), etd = fmtEtd(o.etd);
                return (
                  <button type="button" role="radio" aria-checked={on} key={`${o.courier}|${o.service}`} className="ship-opt" data-act="courier" data-id={`${o.courier}:${o.service}`} onClick={() => onPick({ courier: o.courier, service: o.service })}>
                    <span className="so-dot" aria-hidden="true" />
                    <span className="so-t"><b>{o.courierName || o.courier.toUpperCase()} <span className="so-svc">{o.service}</span></b><span>{[o.description && o.description !== o.service ? o.description : "", etd].filter(Boolean).join(" · ")}</span></span>
                    <span className="so-c money">{c === 0 ? <><b className="so-free">{tr("Gratis")}</b>{o.cost > 0 ? <s>{rp(o.cost)}</s> : null}</> : <b>{rp(c)}</b>}</span>
                  </button>
                );
              })}
            </div>
          )}
          {err?.courier ? <span className="f-err" id="co-courier-err" role="alert">{err.courier}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
