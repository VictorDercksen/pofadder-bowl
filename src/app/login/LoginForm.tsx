"use client";

import { useActionState } from "react";
import { requestSignInLink, type SignInState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(requestSignInLink, { status: "idle" });
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label className="pb-field">
        League email
        <input name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" disabled={state.status === "sent"} />
      </label>
      <div className="pb-actions">
        <button className="pb-primary" type="submit" disabled={pending || state.status === "sent"}>
          {pending ? "Sending…" : state.status === "sent" ? "Link sent" : "Email me a sign-in link"}
        </button>
      </div>
      {state.status === "sent" ? (
        <div className="pb-status" role="status" aria-live="polite">
          Check your inbox for a Pofadder Bowl sign-in link. It expires after a short while and works once.
        </div>
      ) : null}
      {state.status === "error" ? (
        <div className="pb-status" role="alert" style={{ borderLeftColor: "#b3392a" }}>
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
