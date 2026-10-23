// Server components read the language cookie themselves: they render before LangProvider runs.
import { cookies } from "next/headers";
import { applyLang, applyRequestLang, isLang, LANG_COOKIE, type Lang } from "./index";

export async function serverLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(c) ? c : "id";
  applyRequestLang(lang);
  applyLang(lang);
  return lang;
}
