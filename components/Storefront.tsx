"use client";

import { useEffect } from "react";
import type { StoreData } from "@/lib/pos";

/** Mounts the browser storefront (client/store.js) into the static chrome rendered by Shop. */
export function Storefront({ data, api }: { data: StoreData; api: string }) {
  useEffect(() => {
    import("@/client/store.js").then((m) => m.mountStore({ data, api }));
  }, [data, api]);
  return null;
}
