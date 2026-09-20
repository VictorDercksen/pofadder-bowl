"use client";

import { usePathname } from "next/navigation";
import { IconButton, type IconTone } from "@/components/ui/IconButton";
import { setMemberView } from "@/lib/actions/view";

/**
 * Switch between the account's real screens and what a plain league member sees.
 * Stays on the current page where the member view has it; otherwise the page
 * redirects to the member home itself. An eye opens the member view; a struck eye exits it.
 */
export function MemberViewToggle({ viewing, tone = "outline" }: { viewing: boolean; tone?: IconTone }) {
  const pathname = usePathname();
  return (
    <form action={setMemberView} className="pb-view-toggle" data-tour="member-view">
      <input type="hidden" name="next" value={pathname} />
      <input type="hidden" name="mode" value={viewing ? "self" : "member"} />
      <IconButton icon={viewing ? "eyeOff" : "eye"} label={viewing ? "Exit member view" : "View as league member"} type="submit" aria-pressed={viewing} tone={tone} small={tone === "outline"} />
    </form>
  );
}
