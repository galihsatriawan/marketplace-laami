// HTTP status for shop pages whose data cannot be loaded. A page in the App Router cannot pick a 5xx status itself
// (only 404/401/403 via notFound() & co.), so before a shop page renders this checks that the POS answers for its
// store; when it does not (error, unset POS_API_URL, or no answer within POS_TIMEOUT_MS) the request is rewritten
// to /shop-unavailable with status 503 and Retry-After, keeping the URL so "Muat ulang" retries the same page.
// A store that answered in the last OK_TTL_MS is not checked again, so busy pages do not double the POS requests;
// if the POS goes down inside that window the page still shows the same "unavailable" card, just with status 200.
import { NextResponse, type NextRequest } from "next/server";
import { POS_TIMEOUT_MS, posUrl, SLUG_RE } from "@/lib/pos";

const OK_TTL_MS = 10_000;
const okAt = new Map<string, number>();

function slugFor(path: string) {
  const first = path.split("/").filter(Boolean)[0] || "";
  if (!first || first === "p" || first === "r") return (process.env.DEFAULT_STORE || "").trim().toLowerCase();
  return first.toLowerCase();
}

export async function proxy(req: NextRequest) {
  const slug = slugFor(req.nextUrl.pathname);
  // no store (unknown path / no DEFAULT_STORE) or a malformed slug: the page answers 404 itself
  if (!slug || !SLUG_RE.test(slug)) return NextResponse.next();
  if (Date.now() - (okAt.get(slug) || 0) < OK_TTL_MS) return NextResponse.next();
  let up = false;
  if (posUrl()) {
    try {
      const r = await fetch(`${posUrl()}/api/public/stores/${slug}`, { cache: "no-store", headers: { accept: "application/json" }, signal: AbortSignal.timeout(POS_TIMEOUT_MS) });
      // 404 is an answer too: the page shows "not found"
      up = r.ok || r.status === 404;
      if (r.ok) okAt.set(slug, Date.now());
    } catch { /* down or too slow */ }
  }
  if (up) return NextResponse.next();
  return NextResponse.rewrite(new URL("/shop-unavailable", req.url), { status: 503, headers: { "retry-after": "30", "cache-control": "no-store" } });
}

// Page routes only: not Next's own files, the API, metadata routes or files with an extension.
export const config = {
  matcher: ["/((?!_next/|api/|shop-unavailable|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
