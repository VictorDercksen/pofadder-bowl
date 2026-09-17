"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeInternalPath } from "@/lib/paths";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

const schema = z.object({ email: z.string().trim().email().max(200), next: z.string().max(200).optional() });

/** Sends a magic link (and, with the custom template, a 6-digit code) to an existing (invited) account only. Never creates accounts. */
export async function requestSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = schema.safeParse({ email: formData.get("email"), next: formData.get("next") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  const next = safeInternalPath(parsed.data.next, "/");
  const email = parsed.data.email.toLowerCase();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${publicEnv.appOrigin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    // Do not reveal whether an address is invited; only surface rate limits and config problems.
    if (/rate|too many/i.test(error.message)) return { status: "error", message: "Too many requests. Wait a minute and try again." };
    if (/signups? not allowed|not found|otp_disabled/i.test(error.message)) return { status: "sent", email };
    return { status: "error", message: "Sign-in is temporarily unavailable. Try again shortly." };
  }
  return { status: "sent", email };
}

const codeSchema = z.object({ email: z.string().trim().email().max(200), token: z.string().trim().regex(/^\d{6,10}$/), next: z.string().max(200).optional() });

/** The 6-digit code from the sign-in email: the same one-time token as the link, typed instead of clicked. */
export async function verifyEmailCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = codeSchema.safeParse({ email: formData.get("email"), token: formData.get("token"), next: formData.get("next") });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")).toLowerCase() : undefined;
  if (!parsed.success) return { status: "sent", email, message: "Enter the 6-digit code from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email.toLowerCase(), token: parsed.data.token, type: "email" });
  if (error) return { status: "sent", email, message: "That code was wrong or has expired. Request a new link." };
  redirect(safeInternalPath(parsed.data.next, "/home"));
}

const passwordSchema = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200), next: z.string().max(200).optional() });

export type PasswordSignInState = { error?: string };

/** Email + password for members who set one in League access → Password. */
export async function passwordSignIn(_prev: PasswordSignInState, formData: FormData): Promise<PasswordSignInState> {
  const parsed = passwordSchema.safeParse({ email: formData.get("email"), password: formData.get("password"), next: formData.get("next") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email.toLowerCase(), password: parsed.data.password });
  if (error) {
    if (/rate|too many/i.test(error.message)) return { error: "Too many attempts. Wait a minute and try again." };
    return { error: "That email and password did not match. If you never set a password, use the email link instead." };
  }
  redirect(safeInternalPath(parsed.data.next, "/home"));
}
