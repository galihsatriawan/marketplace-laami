import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])';

/**
 * Dialog behaviour for the product sheet and the media viewer: focus `first` on open, keep Tab inside `box`, make
 * the rest of the page inert while open, and give the focus back to whatever opened it on close.
 */
export function useModal(box: RefObject<HTMLElement | null>, first: RefObject<HTMLElement | null>, returnFocus: boolean) {
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const opener = document.activeElement as HTMLElement | null;
    // the dialog sits in its own root next to the page; what comes before it at body level goes inert
    const root = el.closest("body > *") as HTMLElement | null;
    // Layers after this one (a viewer opened over the sheet) stay usable; so does the toast.
    const kids = [...document.body.children];
    const at = root ? kids.indexOf(root) : kids.length;
    const others = kids.filter((c, i): c is HTMLElement => c instanceof HTMLElement && i < at && !c.inert && c.tagName !== "SCRIPT" && c.id !== "toast-root");
    // a dialog opened over another (viewer over sheet) also makes the one below inert
    const below = root ? [...root.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.contains(el) && !c.inert) : [];
    const shut = [...others, ...below];
    shut.forEach((c) => { c.inert = true; });
    first.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!items.length) { e.preventDefault(); return; }
      const a = items[0], z = items[items.length - 1];
      if (!el.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
      else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      shut.forEach((c) => { c.inert = false; });
      if (returnFocus && opener && opener.isConnected && document.body.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [box, first, returnFocus]);
}
