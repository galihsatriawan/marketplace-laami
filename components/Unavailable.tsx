import { tr } from "@/lib/i18n";
import { serverLang } from "@/lib/i18n/server";
import { Reload } from "./Reload";
import { StatePage } from "./StatePage";

/** The shop's data could not be loaded (POS down, slow or misconfigured). */
export async function Unavailable() {
  await serverLang();
  return (
    <StatePage title={tr("Toko sedang tidak bisa dibuka")} text={tr("Coba muat ulang sebentar lagi.")}>
      <Reload label={tr("Muat ulang")} />
    </StatePage>
  );
}
