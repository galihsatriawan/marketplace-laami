import { headers } from "next/headers";

/** This storefront's own origin as the visitor reached it (behind Vercel's proxy too), for absolute URLs. */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host") || "localhost";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
