"use client";
// Gives the request's language to every child: through context on the server (requests render side by side),
// and as the page-wide choice in the browser.
import { createContext, use, type ReactNode } from "react";
import { applyLang, setSsrReader, type Lang } from "./index";

const LangCtx = createContext<Lang | undefined>(undefined);
setSsrReader(() => use(LangCtx));

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  applyLang(lang);
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>;
}
