"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Horizontal mobile nav with active-route highlighting. */
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} className={active ? "active" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
