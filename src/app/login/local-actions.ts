"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

/** True only when the app points at a local Supabase stack (fixture accounts use passwords). */
export async function isLocalStack(): Promise<boolean> {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?/.test(publicEnv.supabaseUrl);
}

export type LocalSignInState = { error?: string };

/**
 * Password sign-in for LOCAL DEVELOPMENT fixtures only (scripts/seed-local-fixtures.ts).
 * Refuses to run against any non-local Supabase URL, so it cannot become a production bypass.
 */
export async function localPasswordSignIn(_prev: LocalSignInState, formData: FormData): Promise<LocalSignInState> {
  if (!(await isLocalStack())) return { error: "Password sign-in is only available against the local development stack." };
  const parsed = z.object({ email: z.string().email(), password: z.string().min(8), next: z.string().optional() }).safeParse({ email: formData.get("email"), password: formData.get("password"), next: formData.get("next") });
  if (!parsed.success) return { error: "Enter the fixture email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: error.message };
  redirect(parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/home");
}
