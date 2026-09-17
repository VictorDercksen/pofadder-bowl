"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeInternalPath } from "@/lib/paths";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string };

const schema = z.object({ email: z.string().trim().email().max(200), next: z.string().max(200).optional() });

/** Sends a magic link to an existing (invited) account only. Never creates accounts. */
export async function requestSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = schema.safeParse({ email: formData.get("email"), next: formData.get("next") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  const next = safeInternalPath(parsed.data.next, "/");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email.toLowerCase(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${publicEnv.appOrigin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    // Do not reveal whether an address is invited; only surface rate limits and config problems.
    if (/rate|too many/i.test(error.message)) return { status: "error", message: "Too many requests. Wait a minute and try again." };
    if (/signups? not allowed|not found|otp_disabled/i.test(error.message)) return { status: "sent" };
    return { status: "error", message: "Sign-in is temporarily unavailable. Try again shortly." };
  }
  return { status: "sent" };
}
