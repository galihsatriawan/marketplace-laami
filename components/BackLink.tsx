"use client";
// "Back to the shop" link on a not-found page, worked out from the URL: a product link drops its /p/<product>,
// a reseller link drops its /r/<code>; anything else goes to the home page.
import { usePathname } from "next/navigation";

export function BackLink({ label, from }: { label: string; from: "product" | "ref" }) {
  const path = (usePathname() || "/").replace(/\/+$/, "");
  const href = from === "product" ? path.replace(/\/p\/[^/]+$/, "") || "/" : path.replace(/\/r\/[^/]+(\/.*)?$/, "") || "/";
  return <a className="btn pri" href={href} data-act="back-to-shop" style={{ marginTop: 8 }}>{label}</a>;
}
