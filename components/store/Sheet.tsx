import type { ReactNode } from "react";

type Props = { title: string; closing: boolean; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean };

/** Bottom sheet on phones, centred dialog from tablet up: "closing" plays the exit animation before it is removed. */
export function Sheet({ title, closing, onClose, children, foot, wide }: Props) {
  return (
    <div className={closing ? "scrim out" : "scrim"} data-act="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={wide ? "sheet wide" : "sheet"} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-h"><h2>{title}</h2><button className="btn ghost sm" data-act="close" onClick={onClose}>Tutup</button></div>
        <div id="sheet-body">{children}</div>
        {foot ? <div className="sheet-f">{foot}</div> : null}
      </div>
    </div>
  );
}
