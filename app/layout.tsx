import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { isLang, LANG_COOKIE } from "@/lib/i18n";
import { LangProvider } from "@/lib/i18n/LangProvider";

// Manrope (variable, latin subset, SIL OFL: fonts/OFL.txt) served with the app: no render-blocking Google Fonts request.
const manrope = localFont({ src: "./fonts/manrope-latin.woff2", weight: "200 800", display: "swap", variable: "--font-manrope",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"] });

export const metadata: Metadata = {
  title: "Toko online",
  description: "Pilih baju, masukkan keranjang, lalu pesan lewat WhatsApp.",
  // Shop pages replace this with the shop's own logo (see shopMetadata).
  icons: { icon: "/icon.svg" },
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
    <html lang={lang} className={manrope.variable}>
      <body><LangProvider lang={lang}>{children}</LangProvider></body>
    </html>
  );
}
