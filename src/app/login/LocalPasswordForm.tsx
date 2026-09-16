"use client";

import { useActionState } from "react";
import { localPasswordSignIn, type LocalSignInState } from "./local-actions";

/** Shown only when the app targets the local Supabase stack. */
export function LocalPasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LocalSignInState, FormData>(localPasswordSignIn, {});
  return (
    <details style={{ marginTop: 16 }}>
      <summary className="pb-small" style={{ cursor: "pointer" }}>Local development stack: sign in with a fixture password</summary>
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <label className="pb-field">
          Fixture email
          <input name="email" type="email" required placeholder="victor@local.test" autoComplete="username" />
        </label>
        <label className="pb-field">
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <div className="pb-actions">
          <button className="pb-secondary" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in (local only)"}</button>
        </div>
        {state.error ? <div className="pb-status" role="alert" style={{ borderLeftColor: "#b3392a" }}>{state.error}</div> : null}
      </form>
    </details>
  );
}
