import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Media } from "@/lib/store";
import { useModal } from "./modal";
import { tr } from "@/lib/i18n";

type Props = { title: string; caption: string; price: string; media: Media[]; start: number; onClose: () => void };

/** Full-screen media viewer: swipe between slides; videos off screen are paused. */
export function Viewer({ title, caption, price, media, start, onClose }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
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
    setIndex(i);
    t.querySelectorAll("video").forEach((x) => { if (x.closest(".viewer-slide") !== t.children[i]) x.pause(); });
  };
  const onScroll = () => { clearTimeout(timer.current); timer.current = setTimeout(sync, 80); };

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={title} ref={box}>
      <div className="viewer-track" id="vtrack" ref={track} onScroll={onScroll}>
        {media.map((m, i) => (
          <div className="viewer-slide" key={`${i}-${m.url}`}>
            {m.type === "video" ? <video src={m.url} controls playsInline preload="metadata" /> : <img src={m.url} alt={`${caption} ${tr("foto {n}", { n: i + 1 })}`} loading={Math.abs(i - start) > 1 ? "lazy" : "eager"} decoding="async" />}
          </div>
        ))}
      </div>
      <div className="viewer-top">
        <span className="viewer-count" id="vcount">{index + 1} / {media.length}</span>
        <button type="button" className="viewer-btn" data-act="viewer-close" aria-label={tr("Tutup")} onClick={onClose} ref={closeBtn}>×</button>
      </div>
      <div className="viewer-bottom"><div className="viewer-cap"><b>{caption}</b><span>{price}</span></div></div>
    </div>
  );
}
