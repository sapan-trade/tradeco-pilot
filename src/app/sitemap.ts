import type { MetadataRoute } from "next";
import { loadHsCatalog } from "@/server/integrations/hts";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const staticRoutes = ["", "/lookup", "/hs-code", "/sign-up"].map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
  }));
  const codeRoutes = loadHsCatalog().map((c) => ({
    url: `${base}/hs-code/${c.hs}`,
    lastModified: new Date(),
  }));
  return [...staticRoutes, ...codeRoutes];
}
