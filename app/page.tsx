import { Shop, storeMetadata } from "@/components/Shop";
import { getStore } from "@/lib/pos";

export const dynamic = "force-dynamic";

/** Home: the shop named by DEFAULT_STORE, or a "shop not found" message. */
const slug = () => (process.env.DEFAULT_STORE || "").trim().toLowerCase();
export async function generateMetadata() { return storeMetadata(slug() ? await getStore(slug()) : { ok: false, status: 404 }); }
export default async function Home() {
  return <Shop result={slug() ? await getStore(slug()) : { ok: false, status: 404 }} />;
}
