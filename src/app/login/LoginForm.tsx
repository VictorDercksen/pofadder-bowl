"use client";

import { useActionState, useState } from "react";
import { Football } from "@/components/ui/Football";
import { passwordSignIn, requestSignInLink, verifyEmailCode, type PasswordSignInState, type SignInState } from "./actions";

/**
 * Two ways in. Password first: every member sets one on their first visit (the /set-password
 * gate), so the email link (or its 6-digit code) is only for the invite and for a forgotten password.
 */
export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"link" | "password">("password");
  return (
    <div>
      <div className="pb-login-tabs" role="tablist" aria-label="Sign-in method">
        <button type="button" role="tab" aria-selected={mode === "password"} className={mode === "password" ? "on" : ""} onClick={() => setMode("password")}>
          Password
        </button>
        <button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? "on" : ""} onClick={() => setMode("link")}>
          Email link
        </button>
      </div>
      {mode === "link" ? <LinkForm next={next} /> : <PasswordForm next={next} />}
    </div>
  );
}

function LinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(requestSignInLink, { status: "idle" });
  const [codeState, codeAction, codePending] = useActionState<SignInState, FormData>(verifyEmailCode, { status: "idle" });
  const sent = state.status === "sent";
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <label className="pb-field">
          League email
          <input name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" disabled={sent} />
        </label>
        <div className="pb-actions">
          <button className="pb-primary" type="submit" disabled={pending || sent}>
            {pending ? <Football size={16} /> : null}
            {pending ? "Sending…" : sent ? "Link sent" : "Email me a sign-in link"}
          </button>
        </div>
        {sent ? (
          <div className="pb-status" role="status" aria-live="polite">
            Check your inbox for a Pofadder Bowl sign-in link. It expires after a short while and works once. Once inside, set your password so you never need another link.
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="pb-status" role="alert" style={{ borderLeftColor: "#b3392a" }}>
            {state.message}
          </div>
        ) : null}
      </form>
      {sent ? (
        <form action={codeAction} className="pb-code-form">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="email" value={state.email ?? ""} />
          <label className="pb-field">
            Link not opening on this device? Type the 6-digit code from the email instead
            <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10} placeholder="123456" required />
          </label>
          <div className="pb-actions">
            <button className="pb-secondary" type="submit" disabled={codePending}>
              {codePending ? <Football size={16} /> : null}
              {codePending ? "Checking…" : "Sign in with the code"}
            </button>
          </div>
          {codeState.message ? (
            <div className="pb-status" role="alert" style={{ borderLeftColor: "#b3392a" }}>
              {codeState.message}
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function PasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<PasswordSignInState, FormData>(passwordSignIn, {});
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label className="pb-field">
        League email
        <input name="email" type="email" required autoComplete="username" inputMode="email" placeholder="you@example.com" />
      </label>
      <label className="pb-field">
        Password
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      <div className="pb-actions">
        <button className="pb-primary" type="submit" disabled={pending}>
          {pending ? <Football size={16} /> : null}
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <p className="pb-small" style={{ marginTop: 12 }}>First time here, or forgotten it? Use the Email link tab: the link signs you in and asks you to set a new password.</p>
      {state.error ? (
        <div className="pb-status" role="alert" style={{ borderLeftColor: "#b3392a" }}>
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
