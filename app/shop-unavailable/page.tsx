import type { Metadata } from "next";
import { Unavailable } from "@/components/Unavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Toko sedang tidak bisa dibuka", robots: { index: false } };

/** Shown by proxy.ts (as a rewrite, status 503) when the POS does not answer for a shop page. */
export default function Page() { return <Unavailable />; }
