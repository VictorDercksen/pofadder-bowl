import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { Icon, type IconName } from "@/components/ui/Icons";

/**
 * Round icon actions that replace the old underlined text links. The label is read by
 * screen readers and shown as the native tooltip; the icon carries the meaning on screen.
 * Tones: outline (default), solid green, orange (the accent action) and gold (on the dark drawer).
 */
export type IconTone = "outline" | "solid" | "orange" | "gold";

type Common = { icon: IconName; label: string; tone?: IconTone; small?: boolean; className?: string };

function classes({ tone = "outline", small, className }: Pick<Common, "tone" | "small" | "className">): string {
  return ["pb-icon-btn", tone !== "outline" ? tone : "", small ? "sm" : "", className ?? ""].filter(Boolean).join(" ");
}

export function IconLink({ icon, label, tone, small, className, ...rest }: Common & Omit<ComponentProps<typeof Link>, "className" | "children" | "aria-label" | "title">) {
  return (
    <Link {...rest} className={classes({ tone, small, className })} aria-label={label} title={label}>
      <Icon name={icon} />
      <span className="pb-sr-only">{label}</span>
    </Link>
  );
}

export function IconButton({ icon, label, tone, small, className, type = "button", ...rest }: Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "aria-label" | "title">) {
  return (
    <button {...rest} type={type} className={classes({ tone, small, className })} aria-label={label} title={label}>
      <Icon name={icon} />
      <span className="pb-sr-only">{label}</span>
    </button>
  );
}

/** Phone tab-bar item: icon over a tiny caption. */
export function IconTab({ icon, label, href, current = false }: { icon: IconName; label: string; href: string; current?: boolean }) {
  return (
    <Link href={href} className="pb-icon-tab" aria-current={current ? "page" : undefined} title={label}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </Link>
  );
}
