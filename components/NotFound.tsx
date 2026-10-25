import { tr } from "@/lib/i18n";
import { serverLang } from "@/lib/i18n/server";
import { BackLink } from "./BackLink";
import { NotFoundAny } from "./NotFoundAny";
import { StatePage } from "./StatePage";

/** 404 pages: an unknown shop, an unknown product or reseller link (with a link back to the shop), any other path
 *  ("page": the home page of an unknown shop, or a path that does not exist). */
export async function NotFound({ kind }: { kind: "shop" | "product" | "ref" | "page" }) {
  await serverLang();
  if (kind === "product") {
    return (
      <StatePage title={tr("Produk tidak ditemukan")} text={tr("Produknya mungkin sudah habis atau linknya berubah.")}>
        <BackLink from="product" label={tr("Lihat produk lain di toko")} />
      </StatePage>
    );
  }
  if (kind === "ref") {
    return (
      <StatePage title={tr("Link reseller tidak berlaku")} text={tr("Kamu tetap bisa belanja langsung di toko.")}>
        <BackLink from="ref" label={tr("Ke toko")} />
      </StatePage>
    );
  }
  if (kind === "shop") return <StatePage title={tr("Toko tidak ditemukan")} text={tr("Cek lagi link tokonya, atau mungkin tokonya sedang tutup.")} />;
  return <StatePage><NotFoundAny /></StatePage>;
}
