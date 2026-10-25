import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";

/** Tags a product description may use (the POS cleans it to the same list); anything else is unwrapped or dropped. */
const ALLOWED = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "H3", "A"]);
/** Elements whose content is never text for the buyer: dropped with everything inside. */
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH", "TEXTAREA", "SELECT", "BUTTON", "FORM", "INPUT", "IMG", "VIDEO", "AUDIO", "LINK", "META", "HEAD", "TITLE"]);
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/**
 * Second, client-side check of the POS-sanitized description: rebuilds it from scratch with only the allowed tags,
 * no attributes except a safe href on links. Returns "" when nothing readable is left (or outside a browser).
 */
export function cleanHtml(html: string): string {
  if (!html || typeof DOMParser === "undefined") return "";
  const src = new DOMParser().parseFromString(`<!doctype html><body>${html}`, "text/html").body;
  const out = document.createElement("div");
  const copy = (from: Node, to: Node, depth: number) => {
    if (depth > 20) return;
    for (const n of Array.from(from.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) { to.appendChild(document.createTextNode(n.textContent || "")); continue; }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const el = n as Element;
      const tag = el.tagName.toUpperCase();
      if (DROP.has(tag)) continue;
      if (!ALLOWED.has(tag)) { copy(el, to, depth + 1); continue; }
      const next = document.createElement(tag.toLowerCase());
      if (tag === "A") {
        const href = (el.getAttribute("href") || "").trim();
        if (!SAFE_HREF.test(href)) { copy(el, to, depth + 1); continue; }
        next.setAttribute("href", href);
        next.setAttribute("rel", "noopener nofollow noreferrer");
        next.setAttribute("target", "_blank");
      }
      copy(el, next, depth + 1);
      to.appendChild(next);
    }
  };
  copy(src, out, 0);
  return out.textContent?.trim() ? out.innerHTML : "";
}

/** The product's "Deskripsi" section: formatted text, folded to a few lines with "Selengkapnya" when long. */
export function Description({ html }: { html?: string }) {
  // cleaned in the browser only (DOMParser), after hydration, so the server and first client render agree
  const [clean, setClean] = useState("");
  useEffect(() => { setClean(cleanHtml(html || "")); }, [html]);
  const box = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (el) setLong(el.scrollHeight > el.clientHeight + 4);
  }, [clean]);
  if (!clean) return null;
  return (
    <section className="pd-desc" aria-labelledby="pd-desc-h">
      <h3 id="pd-desc-h" className="pd-sec-h">{tr("Deskripsi")}</h3>
      {/* the POS sanitizes descriptions and cleanHtml() rebuilds them from an allowlist before they get here */}
      <div ref={box} id="pd-desc-body" className={open ? "rich" : "rich folded"} dangerouslySetInnerHTML={{ __html: clean }} />
      {long || open ? (
        <button type="button" className="link more-link" data-act="desc-more" aria-expanded={open} aria-controls="pd-desc-body" onClick={() => setOpen(!open)}>
          {open ? tr("Lebih sedikit") : tr("Selengkapnya")}
        </button>
      ) : null}
    </section>
  );
}
