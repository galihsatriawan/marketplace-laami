// Server components read the language cookie themselves: they render before LangProvider runs.
import { cookies } from "next/headers";
import { applyLang, isLang, LANG_COOKIE, type Lang } from "./index";

export async function serverLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(c) ? c : "id";
  applyLang(lang);
  return lang;
}
