import { NotFound } from "@/components/NotFound";

/** An unknown product (or a product link under an unknown shop): 404 with a link back to the shop. */
export default function Page() { return <NotFound kind="product" />; }
