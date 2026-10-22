import { ShopPage, shopMetadata } from "@/components/Shop";

export const dynamic = "force-dynamic";

/** A product of the home store: /p/<product>. */
type Props = { params: Promise<{ product: string }> };
export async function generateMetadata({ params }: Props) { return shopMetadata(await params); }
export default async function Page({ params }: Props) { return <ShopPage route={await params} />; }
