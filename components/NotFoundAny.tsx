"use client";
// The app-wide 404: the home page itself (its shop is unknown or switched off) says "shop not found"; any other
// path says "page not found" with a link home.
import { usePathname } from "next/navigation";
import { tr } from "@/lib/i18n";

export function NotFoundAny() {
  const home = (usePathname() || "/") === "/";
  return (
    <>
      <h1 style={{ fontSize: 22 }}>{home ? tr("Toko tidak ditemukan") : tr("Halaman tidak ditemukan")}</h1>
      <p className="muted" style={{ margin: 0 }}>{home ? tr("Cek lagi link tokonya, atau mungkin tokonya sedang tutup.") : tr("Cek lagi linknya.")}</p>
      {home ? null : <a className="btn pri" href="/" data-act="back-to-shop" style={{ marginTop: 8 }}>{tr("Ke beranda toko")}</a>}
    </>
  );
}
