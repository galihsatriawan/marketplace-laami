// The shop's own steps (POS › Pengaturan › Toko online): "Cara belanja" and "Cara retur / tukar", plus the
// free-shipping badge text. Empty lists fall back to the built-in order steps / no returns section.
import type { ReactNode } from "react";
import type { Step, StoreData, StoreShipping } from "@/lib/pos";
import { num, rp } from "@/lib/store";
import { tr } from "@/lib/i18n";
import { Sheet } from "./Sheet";

const clean = (xs: Step[] | undefined) => (Array.isArray(xs) ? xs : []).filter((s) => s && (s.title?.trim() || s.text?.trim()));
/** The shop's "Cara belanja" steps; empty = use the built-in ones. */
export const orderSteps = (d: StoreData) => clean(d.steps?.order);
export const returnSteps = (d: StoreData) => clean(d.steps?.returns);
export const returnNote = (d: StoreData) => (d.steps?.returnNote || "").trim();
/** The returns section shows only when the shop wrote steps or a note. */
export const hasReturns = (d: StoreData) => returnSteps(d).length > 0 || !!returnNote(d);

/** Free-shipping areas worth a badge (the shop may hide the badge). */
export const freeAreas = (s?: StoreShipping) => (s && Array.isArray(s.freeAreas) ? s.freeAreas.filter((a) => a && a.name?.trim()) : []);
export const showFreeBadge = (s?: StoreShipping) => !!s && s.badge !== false && freeAreas(s).length > 0;
/** "Sumberpucung", "Sumberpucung & Kepanjen", "Sumberpucung, Kepanjen +2". */
export function areaNames(s?: StoreShipping) {
  const names = freeAreas(s).map((a) => a.name.trim());
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}
/** "min. belanja Rp150.000" (or "mulai" the lowest when areas differ); "" when one area has no minimum. */
export function areaMin(s?: StoreShipping) {
  const mins = freeAreas(s).map((a) => num(a.minSpend));
  if (!mins.length || mins.some((m) => m <= 0)) return "";
  const lo = Math.min(...mins);
  return mins.every((m) => m === lo) ? tr("min. belanja {rp}", { rp: rp(lo) }) : tr("min. belanja mulai {rp}", { rp: rp(lo) });
}

export const Truck = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v10H3z" /><path d="M14 9h4l3 3.5V16h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>;
export const ReturnIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>;
const Clock = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;

/** The returns steps and note, numbered; used by the footer card and the returns sheet. */
export function ReturnsBody({ data }: { data: StoreData }) {
  const steps = returnSteps(data), note = returnNote(data);
  return (
    <>
      {note ? <p className="ret-note"><Clock /><span>{note}</span></p> : null}
      {steps.length ? (
        <ol className="steps ret-steps">
          {steps.map((s, i) => <li key={i}><i aria-hidden="true">{i + 1}</i><div><b>{s.title}</b>{s.text ? <span>{s.text}</span> : null}</div></li>)}
        </ol>
      ) : null}
    </>
  );
}

/** "Kebijakan retur" as a small link that opens the returns sheet. */
export const ReturnsLink = ({ onOpen, children }: { onOpen: () => void; children?: ReactNode }) => (
  <button type="button" className="ret-link" data-act="returns" onClick={onOpen}><ReturnIcon />{children ?? tr("Kebijakan retur")}</button>
);

export function ReturnsSheet({ data, closing, onClose }: { data: StoreData; closing: boolean; onClose: () => void }) {
  return (
    <Sheet title={tr("Cara retur / tukar")} closing={closing} onClose={onClose}>
      <div className="ret-sheet"><ReturnsBody data={data} /></div>
    </Sheet>
  );
}

/** Under the product's price: the free-shipping areas and the returns link, when the shop has them. */
export function Perks({ data, onReturns }: { data: StoreData; onReturns: () => void }) {
  const ship = showFreeBadge(data.shipping), ret = hasReturns(data);
  if (!ship && !ret) return null;
  const min = areaMin(data.shipping);
  return (
    <div className="pd-perks">
      {ship ? <span className="pd-ship" id="pd-ship"><Truck /><span>{tr("Gratis ongkir area {areas}", { areas: areaNames(data.shipping) })}{min ? <span className="muted"> · {min}</span> : null}</span></span> : null}
      {ret ? <ReturnsLink onOpen={onReturns} /> : null}
    </div>
  );
}
