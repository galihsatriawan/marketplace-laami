import type { ReactNode } from "react";
import { Mark } from "./Mark";

/** A centred card for pages without a shop to show: not found, shop unavailable. Pinned between header and footer. */
export function StatePage({ title, text, children }: { title?: string; text?: string; children?: ReactNode }) {
  return (
    <div className="page">
      <main className="wrap state">
        <section className="panel" style={{ maxWidth: 420, width: "100%" }}>
          <div className="panel-b" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <Mark />
            {title ? <h1 style={{ fontSize: 22 }}>{title}</h1> : null}
            {text ? <p className="muted" style={{ margin: 0 }}>{text}</p> : null}
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
