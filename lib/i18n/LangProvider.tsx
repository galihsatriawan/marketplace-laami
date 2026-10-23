"use client";
// Applies the request's language before any child renders, on the server and in the browser.
import type { ReactNode } from "react";
import { applyLang, type Lang } from "./index";

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  applyLang(lang);
  return <>{children}</>;
}
