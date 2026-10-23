"use client";
// Two-button language picker (ID / EN) for the storefront header.
import { getLang, LANGS, setLang, tr } from "./index";

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const cur = getLang();
  return (
    <div className={"seg lang-switch" + (compact ? " compact" : "")} role="group" aria-label={tr("Bahasa")}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" data-act="lang" data-id={l.id} aria-pressed={cur === l.id} onClick={() => cur !== l.id && setLang(l.id)}>
          {compact ? l.id.toUpperCase() : l.label}
        </button>
      ))}
    </div>
  );
}
