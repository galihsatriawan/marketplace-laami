// Storefront language. Source strings are Indonesian and double as keys; other languages are lookup tables.
// The choice lives in the "lang" cookie so the server render and the browser agree; switching reloads the page.
import { cache, createElement, Fragment, type ReactNode } from "react";
import { EN } from "./en";

export type Lang = "id" | "en";
export const LANGS: { id: Lang; label: string }[] = [{ id: "id", label: "Bahasa Indonesia" }, { id: "en", label: "English" }];
export const LANG_COOKIE = "lang";

const TABLES: Record<Lang, Record<string, string> | null> = { id: null, en: EN };
// In the browser one person uses the page, so a plain variable is enough. A server renders many requests at
// once, so there the language comes from the request: React context during SSR, a per-request cache in server components.
let current: Lang = "id";
let ssrReader: (() => Lang | undefined) | null = null;
const rscLang = cache((): { lang?: Lang } => ({}));

export const isLang = (v: unknown): v is Lang => v === "id" || v === "en";
export function getLang(): Lang {
  if (typeof window !== "undefined") return current;
  try { const l = ssrReader?.(); if (l) return l; } catch { /* not inside a render */ }
  try { const l = rscLang().lang; if (l) return l; } catch { /* no request cache here */ }
  return current;
}
/** Set by LangProvider at the top of every render tree; never call from components. */
export const applyLang = (l: Lang) => { current = l; };
/** Server components: remember this request's language (see serverLang). */
export const applyRequestLang = (l: Lang) => { rscLang().lang = l; };
/** LangProvider registers how to read its context while rendering on the server. */
export const setSsrReader = (f: () => Lang | undefined) => { ssrReader = f; };

/** Translate an Indonesian source string; `{name}` placeholders are filled from vars. */
export function tr(s: string, vars?: Record<string, string | number>): string {
  const out = TABLES[getLang()]?.[s] ?? s;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

/** Save the choice and reload so every screen, including server-rendered parts, picks it up. */
export function setLang(l: Lang) {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  location.reload();
}

/** Like tr, for sentences with an element inside (a link, bold text): returns nodes to render. */
export function trn(s: string, vars: Record<string, ReactNode>): ReactNode {
  const out = TABLES[getLang()]?.[s] ?? s;
  return out.split(/\{(\w+)\}/).map((part, i) => createElement(Fragment, { key: i }, i % 2 ? vars[part] : part));
}
