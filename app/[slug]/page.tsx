import { Shop, storeMetadata } from "@/components/Shop";
import { getStore } from "@/lib/pos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { return storeMetadata(await getStore((await params).slug)); }
export default async function StorePage({ params }: Props) {
  return <Shop result={await getStore((await params).slug)} />;
}
