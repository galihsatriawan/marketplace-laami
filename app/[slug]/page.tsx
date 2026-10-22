import { ShopPage, shopMetadata } from "@/components/Shop";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { return shopMetadata(await params); }
export default async function StorePage({ params }: Props) { return <ShopPage route={await params} />; }
