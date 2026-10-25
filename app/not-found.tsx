import { NotFound } from "@/components/NotFound";

/** Any unknown path, and the home page when its shop (DEFAULT_STORE) is unknown or switched off. */
export default function Page() { return <NotFound kind="page" />; }
