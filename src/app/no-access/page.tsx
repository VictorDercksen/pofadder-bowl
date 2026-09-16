import Link from "next/link";
import { getVerifiedUser } from "@/lib/league";

export const metadata = { title: "No league access" };
export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const { user } = await getVerifiedUser();
  return (
    <div className="pb">
      <main className="pb-content" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="pb-kicker">PRIVATE LEAGUE</div>
        <h1>Not on the roster.</h1>
        <div className="pb-panel" style={{ marginTop: 18 }}>
          <p style={{ fontSize: 13 }}>
            {user ? `You are signed in as ${user.email}, but that account has no active membership in this league. Ask the commissioner to invite this address or activate your seat.` : "Sign in with your invited league email."}
          </p>
          <div className="pb-actions">
            {user ? (
              <form action="/auth/signout" method="post">
                <button className="pb-secondary" type="submit">Sign out</button>
              </form>
            ) : (
              <Link className="pb-primary" href="/login">Sign in</Link>
            )}
            <Link className="pb-secondary" href="/teaser">Teaser</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
