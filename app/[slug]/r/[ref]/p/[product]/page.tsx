import { ShopPage, shopMetadata } from "@/components/Shop";

export const dynamic = "force-dynamic";

/** A product through a reseller's link: /<slug>/r/<code>/p/<product>. */
type Props = { params: Promise<{ slug: string; ref: string; product: string }> };
export async function generateMetadata({ params }: Props) { return shopMetadata(await params); }
export default async function Page({ params }: Props) { return <ShopPage route={await params} />; }
