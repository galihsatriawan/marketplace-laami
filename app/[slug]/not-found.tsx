import { NotFound } from "@/components/NotFound";

/** An unknown or switched-off shop (and anything under it without a closer not-found). */
export default function Page() { return <NotFound kind="shop" />; }
