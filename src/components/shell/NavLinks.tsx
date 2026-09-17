"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Football } from "@/components/ui/Football";

import type { NavItem } from "@/components/shell/nav";

export type { NavItem } from "@/components/shell/nav";

/** Shows the tumbling football in place of the screen number while that link's navigation is pending. */
export function NavNumber({ n, className }: { n: string; className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={`${className ?? ""} ${pending ? "pending" : ""}`.trim()} aria-hidden={pending ? true : undefined}>
      {pending ? <Football size={18} /> : n}
    </span>
  );
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} className="pb-nav" aria-current={active ? "page" : undefined}>
            <NavNumber n={item.n} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
