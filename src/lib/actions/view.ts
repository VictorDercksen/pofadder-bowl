"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLeagueContextRaw, homeFor, MEMBER_VIEW_COOKIE } from "@/lib/league";

/** Only same-origin paths; anything else falls back to the role home. */
function safePath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * Switches an elevated account (admin, commissioner or participant) into or out of the
 * league member view. The cookie only ever removes capabilities: pages and server
 * actions treat the account as a member while it is set, and the database keeps
 * enforcing the real role regardless.
 */
export async function setMemberView(formData: FormData): Promise<void> {
  const mode = formData.get("mode") === "member" ? "member" : "self";
  const ctx = await getLeagueContextRaw();
  const store = await cookies();
  if (mode === "member") {
    if (!ctx.canViewAsMember) redirect(homeFor(ctx));
    store.set({ name: MEMBER_VIEW_COOKIE, value: "1", path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12 });
  } else {
    store.delete(MEMBER_VIEW_COOKIE);
  }
  revalidatePath("/", "layout");
  // Member view has no My trip / Proof locker / Commissioner screens: those pages redirect on their own.
  redirect(safePath(formData.get("next")) ?? (mode === "member" ? "/game-centre" : homeFor(ctx)));
}
