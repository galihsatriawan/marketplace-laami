import { useRef, type ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { useModal } from "./modal";

type Props = {
  title: string; closing: boolean; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean; returnFocus?: boolean;
  /** bare: the content shows its own title (the product sheet), so the header keeps only `lead` and "Tutup". */
  bare?: boolean; lead?: ReactNode;
};

/** Bottom sheet on phones, centred dialog from tablet up: "closing" plays the exit animation before it is removed.
 *  Focus starts on "Tutup", stays inside while open and returns to the opener afterwards. */
export function Sheet({ title, closing, onClose, children, foot, wide, returnFocus = true, bare, lead }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useModal(box, closeBtn, returnFocus);
  return (
    <div className={closing ? "scrim out" : "scrim"} data-act="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet${wide ? " wide" : ""}${bare ? " bare" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={box}>
        <div className="sheet-h">
          {bare ? <div className="sheet-lead">{lead}</div> : <h2 title={title}>{title}</h2>}
          <button ref={closeBtn} className="btn ghost sm" data-act="close" onClick={onClose}>{tr("Tutup")}</button>
        </div>
        <div id="sheet-body">{children}</div>
        {foot ? <div className="sheet-f">{foot}</div> : null}
      </div>
    </div>
  );
}
