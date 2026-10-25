import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Media } from "@/lib/store";
import { useModal } from "./modal";
import { tr } from "@/lib/i18n";

type Props = { title: string; caption: string; price: string; media: Media[]; start: number; onClose: () => void };
type Zoom = { s: number; x: number; y: number };
const Z0: Zoom = { s: 1, x: 0, y: 0 };
const MAX = 4, TAP_ZOOM = 2.5;

/** Keeps a zoomed picture covering its slide: no panning past its edges. */
function clamp(z: Zoom, w: number, h: number): Zoom {
  const s = Math.min(MAX, Math.max(1, z.s));
  if (s === 1) return Z0;
  const mx = ((s - 1) * w) / 2, my = ((s - 1) * h) / 2;
  return { s, x: Math.min(mx, Math.max(-mx, z.x)), y: Math.min(my, Math.max(-my, z.y)) };
}

/** Full-screen media viewer: swipe between slides; pinch, double-tap or the zoom button to zoom a photo, drag to pan
 *  it. Videos off screen are paused. */
export function Viewer({ title, caption, price, media, start, onClose }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState<Zoom>(Z0);
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useModal(box, closeBtn, true);

  useLayoutEffect(() => {
    const t = track.current;
    if (t) t.scrollLeft = start * t.clientWidth;
  }, [start]);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const sync = () => {
    const t = track.current;
    if (!t) return;
    const i = Math.round(t.scrollLeft / t.clientWidth);
    if (i !== index) setZoom(Z0);
    setIndex(i);
    t.querySelectorAll("video").forEach((x) => { if (x.closest(".viewer-slide") !== t.children[i]) x.pause(); });
  };
  const onScroll = () => { clearTimeout(timer.current); timer.current = setTimeout(sync, 80); };

  // gesture state: active pointers, the pinch start, the last tap (for double-tap)
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: Zoom; cx: number; cy: number } | null>(null);
  const pan = useRef<{ x: number; y: number; z: Zoom } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const slideSize = () => { const t = track.current; return { w: t?.clientWidth || 1, h: t?.clientHeight || 1 }; };
  /** Zooms to `s` keeping the point (px, py) of the slide (from its centre) where it is. */
  const zoomAt = (s: number, px: number, py: number, from = zoom) => {
    const { w, h } = slideSize();
    const k = s / from.s;
    setZoom(clamp({ s, x: px - (px - from.x) * k, y: py - (py - from.y) * k }, w, h));
  };
  const rel = (e: { clientX: number; clientY: number }, el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      const c = rel({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }, e.currentTarget);
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoom, cx: c.x, cy: c.y };
      pan.current = null;
    } else if (pts.current.size === 1 && zoom.s > 1) {
      pan.current = { x: e.clientX, y: e.clientY, z: zoom };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { w, h } = slideSize();
    if (pinch.current && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const p = pinch.current;
      const s = Math.min(MAX, Math.max(1, p.z.s * (Math.hypot(a.x - b.x, a.y - b.y) / p.d)));
      const k = s / p.z.s;
      setZoom(clamp({ s, x: p.cx - (p.cx - p.z.x) * k, y: p.cy - (p.cy - p.z.y) * k }, w, h));
    } else if (pan.current) {
      const p = pan.current;
      setZoom(clamp({ s: p.z.s, x: p.z.x + e.clientX - p.x, y: p.z.y + e.clientY - p.y }, w, h));
    }
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const had = pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    if (!pts.current.size) {
      const moved = pan.current ? Math.hypot(e.clientX - pan.current.x, e.clientY - pan.current.y) : 0;
      pan.current = null;
      if (!had || moved > 10 || e.type === "pointercancel") return;
      // double tap: zoom in at that point, or back out
      const now = Date.now(), l = lastTap.current;
      if (l && now - l.t < 320 && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 30) {
        lastTap.current = null;
        if (zoom.s > 1) setZoom(Z0); else { const p = rel(e, e.currentTarget); zoomAt(TAP_ZOOM, p.x, p.y); }
      } else lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && zoom.s === 1) return; // plain wheel scrolls the slides; ctrl / trackpad pinch zooms
    const p = rel(e, e.currentTarget);
    zoomAt(Math.min(MAX, Math.max(1, zoom.s * Math.exp(-e.deltaY / 300))), p.x, p.y);
  };

  const zoomed = zoom.s > 1;
  const current = media[index];
  return (
    <div className={zoomed ? "viewer zoomed" : "viewer"} role="dialog" aria-modal="true" aria-label={title} ref={box}>
      <div className="viewer-track" id="vtrack" ref={track} onScroll={onScroll}>
        {media.map((m, i) => (
          <div className="viewer-slide" key={`${i}-${m.url}`}>
            {m.type === "video" ? <video src={m.url} controls playsInline preload="metadata" /> : (
              <div className="viewer-zoom" data-act="viewer-zoom" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
                <img src={m.url} alt={`${caption} ${tr("foto {n}", { n: i + 1 })}`} loading={Math.abs(i - start) > 1 ? "lazy" : "eager"} decoding="async" draggable={false}
                  style={i === index && zoomed ? { transform: `translate(${zoom.x}px,${zoom.y}px) scale(${zoom.s})` } : undefined} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="viewer-top">
        <span className="viewer-count" id="vcount">{index + 1} / {media.length}</span>
        <div className="viewer-acts">
          {current?.type === "image" ? (
            <button type="button" className="viewer-btn" data-act="viewer-zoom-btn" aria-label={zoomed ? tr("Perkecil") : tr("Perbesar")} aria-pressed={zoomed}
              onClick={() => (zoomed ? setZoom(Z0) : zoomAt(TAP_ZOOM, 0, 0, Z0))}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M8 11h6" />{zoomed ? null : <path d="M11 8v6" />}</svg>
            </button>
          ) : null}
          <button type="button" className="viewer-btn" data-act="viewer-close" aria-label={tr("Tutup")} onClick={onClose} ref={closeBtn}>×</button>
        </div>
      </div>
      <div className="viewer-bottom">
        <div className="viewer-cap"><b>{caption}</b><span>{price}</span></div>
        {!zoomed && current?.type === "image" ? <span className="viewer-hint">{tr("Ketuk dua kali untuk zoom")}</span> : null}
      </div>
    </div>
  );
}
