"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { n: string; label: string; href: string; roles?: string[] };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} className="pb-nav" aria-current={active ? "page" : undefined}>
            <span>{item.n}</span>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
