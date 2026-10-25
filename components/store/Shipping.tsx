// Checkout shipping when the shop prices it live (RajaOngkir / Biteship through the POS): pick the destination
// (kecamatan / kelurahan search), then a courier service. Any failure falls back to "Ongkir dikabari toko".
// The shop's RajaOngkir plan allows only ~100 lookups a day, so this asks as rarely as it can: searches run on
// Enter / "Cari" / a long pause, answers are kept for the session, and a price is asked again only when the
// destination or the parcel's whole-kg weight changes (and then only when the buyer taps "Cek ongkir").
import { useEffect, useRef, useState } from "react";
import type { Destination, ShipOption, ShipQuote, StoreData } from "@/lib/pos";
import { FETCH_TIMEOUT_MS, findProduct, rp, session, type CartLine } from "@/lib/store";
import { tr } from "@/lib/i18n";
import { Truck } from "./Steps";

export type ShipPick = { courier: string; service: string };
/** The search needs this many letters before it asks the shop. */
export const DEST_MIN = 4;
/** A search starts by itself only after the buyer stops typing this long (Enter / "Cari" start it at once). */
const DEST_IDLE_MS = 800;
/** Grams per pcs when the catalog gives a product no weight (the POS's own default). */
export const DEFAULT_WEIGHT_G = 300;
/** Recent destinations offered as one-tap chips. */
export const RECENT_MAX = 3;

/** Parcel weight in whole kg (what couriers charge by): Σ qty × grams per pcs, rounded up, at least 1. */
export function cartWeightKg(data: StoreData, cart: CartLine[]) {
  const g = cart.reduce((a, c) => {
    const w = Number(findProduct(data, c.productId)?.weight);
    return a + (Number.isFinite(w) && w > 0 ? w : DEFAULT_WEIGHT_G) * (Number(c.qty) || 0);
  }, 0);
  return Math.max(1, Math.ceil(g / 1000));
}

/** Why live ongkir stopped, from a failed answer: 503 with quota "out" (allowance used up) or 429 (asked too often). */
export async function quotaNote(r: Response): Promise<{ why: string; retryMs: number } | null> {
  if (r.status === 429) {
    const j = (await r.clone().json().catch(() => null)) as { retryAfter?: number } | null;
    const s = Number(j?.retryAfter ?? r.headers.get("retry-after"));
    return { why: tr("Cek ongkir sedang terlalu sering dipakai."), retryMs: (Number.isFinite(s) && s > 0 ? s : 60) * 1000 };
  }
  if (r.status === 503) {
    const j = (await r.clone().json().catch(() => null)) as { quota?: string } | null;
    if (j?.quota === "out") return { why: tr("Kuota cek ongkir toko hari ini sudah habis."), retryMs: 60 * 60 * 1000 };
  }
  return null;
}

/** fetch for the paid ongkir endpoints with the shop's ship token (see useShipToken); `init` is called per attempt. */
export type ShipFetch = (url: string, init: () => RequestInit) => Promise<Response>;

/** Destination searches answered this session, per lowercased query (memory + sessionStorage). */
const destCacheKey = (slug: string) => `toko.destq.${slug}`;
const destMem = new Map<string, Destination[]>();
function cachedDests(slug: string, q: string): Destination[] | null {
  const k = `${slug}|${q}`;
  if (destMem.has(k)) return destMem.get(k)!;
  const all = session.get<Record<string, Destination[]>>(destCacheKey(slug), {});
  const hit = all && typeof all === "object" && Array.isArray(all[q]) ? all[q] : null;
  if (hit) destMem.set(k, hit);
  return hit;
}
function keepDests(slug: string, q: string, list: Destination[]) {
  destMem.set(`${slug}|${q}`, list);
  const all = session.get<Record<string, Destination[]>>(destCacheKey(slug), {}) || {};
  const keys = Object.keys(all).filter((x) => x !== q).slice(-19);
  session.set(destCacheKey(slug), Object.fromEntries([...keys.map((x) => [x, all[x]]), [q, list]]));
}

/** "2-3 day" / "2-3 HARI" / "1" → "2-3 hari"; "" when the courier gives none. */
export function fmtEtd(etd: string | undefined) {
  const t = String(etd || "").replace(/\s*(days?|hari)\s*$/i, "").trim();
  return t ? tr("{etd} hari", { etd: t }) : "";
}
export const sameOpt = (a: ShipPick | null, b: ShipOption) => !!a && a.courier === b.courier && a.service === b.service;
/** What the buyer pays for this option: 0 when the order ships free, else the cost less the ongkir subsidy. */
export const optCost = (q: ShipQuote, o: ShipOption) => (q.free ? 0 : typeof o.pay === "number" ? Math.min(o.pay, o.cost) : o.cost);
/** The courier's own price for this option (before the subsidy): 0 when the order ships free. */
export const optRaw = (q: ShipQuote, o: ShipOption) => (q.free ? 0 : o.cost);
/** Cheapest first; the shop's own order breaks ties. */
export const sortOpts = (os: ShipOption[]) => [...os].filter((o) => o && o.courier && o.service).sort((a, b) => a.cost - b.cost);

type Props = {
  api: string; slug: string;
  dest: Destination | null; onDest: (d: Destination | null) => void;
  /** The price for this destination and the cart's current weight; null = not asked yet (or the weight changed). */
  quote: ShipQuote | null; loading: boolean;
  /** The cart got heavier / lighter (whole kg) since the last price for this destination: ask again with "Cek ulang". */
  stale: "up" | "down" | null;
  onCheck: () => void;
  /** The buyer's last destinations, newest first: one tap, no search. */
  recent: Destination[];
  /** The shop's allowance is low: new searches may be refused (answers the shop already has still come back). */
  limited?: boolean;
  pick: ShipPick | null; onPick: (p: ShipPick) => void;
  /** The shop's shipping prices cannot be reached: the reason (shown) and how long to wait; the order goes without shipping. */
  onDown: (msg: string, retryMs?: number) => void;
  shipFetch: ShipFetch;
  err?: { dest?: string; courier?: string };
  destRef?: React.RefObject<HTMLInputElement | null>;
  optsRef?: React.RefObject<HTMLDivElement | null>;
};

export function ShipBox({ api, slug, dest, onDest, quote, loading, stale, onCheck, recent, limited, pick, onPick, onDown, shipFetch, err, destRef, optsRef }: Props) {
  const [q, setQ] = useState("");
  // results for `forQ` (what was searched), so typing on does not pretend the old list matches
  const [found, setFound] = useState<{ q: string; list: Destination[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(!dest);
  // searching was refused (allowance used up) while prices may still work: recent destinations only
  const [searchOff, setSearchOff] = useState(false);
  const listId = "co-dest-list";
  const onDownRef = useRef(onDown);
  onDownRef.current = onDown;
  const inflight = useRef<AbortController | null>(null);
  const inflightQ = useRef("");
  const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
  const s = norm(q);
  const results = found && found.q === s ? found.list : null;

  /** Searches `text` now: from the session's answers when it was asked before, else one request (older ones cancelled). */
  const search = async (text: string) => {
    const t = norm(text);
    if (t.length < DEST_MIN) return;
    const hit = cachedDests(slug, t);
    if (hit) { inflight.current?.abort(); setSearching(false); setFound({ q: t, list: hit }); return; }
    if (found?.q === t || searchOff) return;
    // the same words already on the way (Enter right before the pause ran out): wait for that answer
    if (inflightQ.current === t && inflight.current && !inflight.current.signal.aborted) return;
    inflight.current?.abort();
    const ac = new AbortController();
    inflight.current = ac;
    inflightQ.current = t;
    setSearching(true);
    try {
      const r = await shipFetch(`${api}/api/public/stores/${slug}/shipping/destinations?q=${encodeURIComponent(t)}`,
        () => ({ signal: AbortSignal.any ? AbortSignal.any([ac.signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]) : ac.signal, cache: "no-store" }));
      if (ac.signal.aborted) return;
      inflightQ.current = "";
      const quota = await quotaNote(r);
      // with a destination to fall back on (picked or recent), only the search stops; else the shop tells the cost
      if (quota && r.status === 503 && (limited || dest || recent.length)) { setSearching(false); setSearchOff(true); return; }
      if (quota) { setSearching(false); onDownRef.current(quota.why, quota.retryMs); return; }
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { results?: Destination[] };
      const list = Array.isArray(j.results) ? j.results.slice(0, 20) : [];
      keepDests(slug, t, list);
      if (inflight.current !== ac) return;
      setFound({ q: t, list });
      setSearching(false);
    } catch (e) {
      if (ac.signal.aborted) return;
      inflightQ.current = "";
      setSearching(false);
      onDownRef.current((e as Error)?.name === "TimeoutError" ? tr("Cek ongkir sedang lambat.") : tr("Cek ongkir sedang tidak bisa dipakai."));
    }
  };
  const searchRef = useRef(search);
  searchRef.current = search;

  // typing never asks the shop per letter: a search starts by itself only after a long pause
  useEffect(() => {
    if (s.length < DEST_MIN) { inflight.current?.abort(); setSearching(false); return; }
    if (cachedDests(slug, s)) { searchRef.current(s); return; }
    const t = setTimeout(() => searchRef.current(s), DEST_IDLE_MS);
    return () => clearTimeout(t);
  }, [s, slug]);
  useEffect(() => () => inflight.current?.abort(), []);

  const choose = (d: Destination) => { inflight.current?.abort(); onDest(d); setOpen(false); setQ(""); setFound(null); setSearching(false); };
  const opts = quote ? sortOpts(quote.options) : [];
  const chips = recent.filter((d) => !dest || String(d.id) !== String(dest.id)).slice(0, RECENT_MAX);
  const short = s.length < DEST_MIN;

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
            <div className="dest-row">
              <input ref={destRef} className="in" id="co-dest" type="search" autoComplete="off" enterKeyHint="search" value={q} maxLength={60}
                placeholder={tr("Ketik nama kecamatan atau kelurahan")} role="combobox" aria-expanded={!!results?.length} aria-controls={listId} aria-autocomplete="list"
                aria-invalid={err?.dest ? true : undefined} aria-describedby={err?.dest ? "co-dest-err" : "co-dest-hint"}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); if (results?.length) choose(results[0]); else search(q); }
                  if (e.key === "Escape" && dest) { e.stopPropagation(); setOpen(false); }
                }} />
              <button type="button" className="btn" data-act="dest-search" disabled={short || searching || searchOff} onClick={() => search(q)}>{tr("Cari")}</button>
            </div>
            {err?.dest ? <span className="f-err" id="co-dest-err" role="alert">{err.dest}</span>
              : <span className="hint" id="co-dest-hint" aria-live="polite">{searchOff ? tr("Pencarian tujuan sedang tidak tersedia. Pilih tujuan terakhir, atau lanjut pesan: ongkir dikabari toko lewat WhatsApp.")
                : limited && !s ? tr("Pencarian tujuan terbatas hari ini. Pilih tujuan terakhir kalau ada, atau ketik kecamatan.") : searching ? tr("Mencari…") : short ? tr("Minimal {n} huruf, contoh: Sumberpucung", { n: DEST_MIN }) : !results ? tr("Tekan Cari atau Enter untuk mencari.") : !results.length ? tr("Tidak ketemu. Coba nama kecamatan lain.") : tr("Pilih salah satu di bawah.")}</span>}
            {!s && chips.length ? (
              <div className="dest-recent" role="group" aria-label={tr("Tujuan terakhir")}>
                <span className="small muted">{tr("Terakhir dipakai")}</span>
                {chips.map((d) => (
                  <button type="button" key={String(d.id)} className="chip" data-act="dest-recent" data-id={String(d.id)} title={d.label} onClick={() => choose(d)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                    <span>{shortLabel(d.label)}</span>{d.free ? <span className="free-tag">{tr("Gratis ongkir")}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {results?.length ? (
              <ul className="dest-list" id={listId} role="listbox" aria-label={tr("Hasil pencarian tujuan")}>
                {results.map((d) => (
                  <li key={String(d.id)} role="option" aria-selected={!!dest && String(dest.id) === String(d.id)}>
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
          {quote?.free ? <div className="ship-free" id="co-ship-free"><Truck /><span>{tr("Gratis ongkir (area {area})", { area: quote.freeArea || "" })}</span></div>
            : quote?.freeArea && quote.minSpendLeft ? <div className="ship-free soon" id="co-ship-soon"><Truck /><span>{tr("Belanja {rp} lagi untuk gratis ongkir", { rp: rp(quote.minSpendLeft) })}{!opts.length ? <small>{tr("Ongkir dikabari toko lewat WhatsApp.")}</small> : null}</span></div> : null}
          {loading ? <div className="ship-load" role="status">{tr("Menghitung ongkir…")}</div>
            : !quote ? (
              <div className={stale ? "ship-check stale" : "ship-check"} id="co-ship-check">
                <span>{stale === "up" ? tr("Ongkir berubah karena berat paket naik") : stale === "down" ? tr("Ongkir berubah karena berat paket turun") : tr("Cek ongkir ke tujuan ini dulu.")}</span>
                <button type="button" className="btn sm pri" data-act="ship-check" onClick={onCheck}>{stale ? tr("Cek ulang") : tr("Cek ongkir")}</button>
              </div>
            )
            : !opts.length ? (quote.free || quote.minSpendLeft ? null : <div className="ship-load">{tr("Belum ada kurir ke tujuan ini. Ongkir dikabari toko lewat WhatsApp.")}</div>) : (
            <div className="ship-opts" role="radiogroup" aria-labelledby="co-courier-l" aria-invalid={err?.courier ? true : undefined} aria-describedby={err?.courier ? "co-courier-err" : undefined}>
              {opts.map((o) => {
                const on = sameOpt(pick, o), c = optCost(quote, o), etd = fmtEtd(o.etd);
                return (
                  <button type="button" role="radio" aria-checked={on} key={`${o.courier}|${o.service}`} className="ship-opt" data-act="courier" data-id={`${o.courier}:${o.service}`} onClick={() => onPick({ courier: o.courier, service: o.service })}>
                    <span className="so-dot" aria-hidden="true" />
                    <span className="so-t"><b>{o.courierName || o.courier.toUpperCase()} <span className="so-svc">{o.service}</span></b><span>{[o.description && o.description !== o.service ? o.description : "", etd].filter(Boolean).join(" · ")}</span></span>
                    <span className="so-c money">{c === 0 ? <><b className="so-free">{tr("Gratis")}</b>{o.cost > 0 ? <s>{rp(o.cost)}</s> : null}</>
                      : c < o.cost ? <><span className="so-was"><s>{rp(o.cost)}</s> <b>{rp(c)}</b></span><small className="so-save">{tr("hemat {rp}", { rp: rp(o.cost - c) })}</small></>
                      : <b>{rp(c)}</b>}</span>
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

/** "JATIGUWI, SUMBERPUCUNG, MALANG, JAWA TIMUR, 65165" → "Jatiguwi, Sumberpucung, Malang" for a chip. */
function shortLabel(label: string) {
  return label.split(",").slice(0, 3).map((x) => x.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())).filter(Boolean).join(", ");
}
