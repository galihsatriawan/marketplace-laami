import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { isLang, LANG_COOKIE } from "@/lib/i18n";
import { LangProvider } from "@/lib/i18n/LangProvider";

export const metadata: Metadata = {
  title: "Toko online",
  description: "Pilih baju, masukkan keranjang, lalu pesan lewat WhatsApp.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0c" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(c) ? c : "id";
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" />
      </head>
      <body><LangProvider lang={lang}>{children}</LangProvider></body>
    </html>
  );
}
