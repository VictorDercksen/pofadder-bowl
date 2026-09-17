import { SessionFromFragment } from "./SessionFromFragment";
import { safeInternalPath } from "@/lib/paths";

export const metadata = { title: "Signing in" };
export const dynamic = "force-dynamic";

/**
 * Landing for Supabase's default (implicit-flow) email links, which return the session
 * in the URL fragment. The browser client stores it in cookies, then we continue.
 */
export default async function AuthSessionPage(props: PageProps<"/auth/session">) {
  const params = await props.searchParams;
  const next = safeInternalPath(params.next, "/home");
  return (
    <div className="pb">
      <main className="pb-content" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="pb-kicker">LEAGUE ACCESS</div>
        <h1>Checking your ticket…</h1>
        <SessionFromFragment next={next} />
      </main>
    </div>
  );
}
