import { num } from "@/lib/store";
import { tr } from "@/lib/i18n";

/** A big amount with a smaller "Rp" prefix. */
export function MoneyBig({ value }: { value: number }) {
  const n = Math.round(num(value));
  return <>{n < 0 ? "−" : ""}<span className="cur">{tr("Rp")}</span>{Math.abs(n).toLocaleString("id-ID")}</>;
}
