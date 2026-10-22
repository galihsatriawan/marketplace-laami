import { posUrl } from "@/lib/pos";

export const dynamic = "force-dynamic";

/** Setup check: which env this deployment reads and what the POS answers for DEFAULT_STORE. No secrets in here. */
export async function GET() {
  const pos = posUrl();
  const store = (process.env.DEFAULT_STORE || "").trim().toLowerCase();
  let check: Record<string, unknown> = { skipped: "POS_API_URL or DEFAULT_STORE is empty" };
  if (pos && store) {
    const url = `${pos}/api/public/stores/${encodeURIComponent(store)}`;
    try {
      const r = await fetch(url, { cache: "no-store", headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      check = { url, status: r.status, body: (await r.text()).slice(0, 160) };
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      check = { url, error: err.message, cause: err.cause?.code || err.cause?.message };
    }
  }
  return Response.json({ POS_API_URL: pos || "(empty)", DEFAULT_STORE: store || "(empty)", check });
}
