"use client";

import { usePathname } from "next/navigation";
import { setMemberView } from "@/lib/actions/view";

/**
 * Switch between the account's real screens and what a plain league member sees.
 * Stays on the current page where the member view has it; otherwise the page
 * redirects to the member home itself.
 */
export function MemberViewToggle({ viewing, variant = "text" }: { viewing: boolean; variant?: "text" | "button" }) {
  const pathname = usePathname();
  const className = variant === "button" ? (viewing ? "pb-primary orange" : "pb-secondary") : "pb-text-action";
  return (
    <form action={setMemberView} className="pb-view-toggle" data-tour="member-view">
      <input type="hidden" name="next" value={pathname} />
      <input type="hidden" name="mode" value={viewing ? "self" : "member"} />
      <button className={className} type="submit" aria-pressed={viewing}>
        {viewing ? "Exit member view" : "View as league member"}
      </button>
    </form>
  );
}
