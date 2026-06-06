"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  BarChart3,
  Boxes,
  ScanLine,
  FileText,
  Plug,
  Scale,
  ShieldCheck,
  CreditCard,
  Inbox,
  Store,
  ClipboardList,
  KeyRound,
  type LucideIcon,
} from "lucide-react";

const ICON: Record<string, LucideIcon> = {
  LayoutDashboard,
  Bell,
  BarChart3,
  Boxes,
  ScanLine,
  FileText,
  Plug,
  Scale,
  ShieldCheck,
  CreditCard,
  Inbox,
  Store,
  ClipboardList,
  KeyRound,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICON;
  badge?: number;
}

/** Sidebar nav with icons + active-route highlighting (client — needs usePathname). */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        const Icon = ICON[it.icon];
        return (
          <Link key={it.href} href={it.href} className={active ? "navlink active" : "navlink"}>
            {Icon && <Icon size={16} />}
            <span>{it.label}</span>
            {it.badge ? <span className="navbadge">{it.badge}</span> : null}
          </Link>
        );
      })}
    </>
  );
}
