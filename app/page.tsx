import { ShopPage, shopMetadata } from "@/components/Shop";

export const dynamic = "force-dynamic";

/** Home: the shop named by DEFAULT_STORE, or a "shop not found" message. */
export async function generateMetadata() { return shopMetadata({}); }
export default async function Home() { return <ShopPage route={{}} />; }
