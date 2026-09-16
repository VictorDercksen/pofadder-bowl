import Link from "next/link";
import { isBackendConfigured } from "@/lib/env";

export const metadata = { title: "Setup required" };

export default async function SetupPage(props: PageProps<"/setup">) {
  const params = await props.searchParams;
  const configured = isBackendConfigured();
  const reason = typeof params.reason === "string" ? params.reason : "";
  return (
    <div className="pb">
      <main className="pb-content" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="pb-kicker">BACKEND SETUP</div>
        <h1>{configured ? "Almost there." : "No backend configured."}</h1>
        <div className="pb-panel" style={{ marginTop: 18 }}>
          {!configured ? (
            <>
              <p>
                This deployment has no Supabase project configured, so there is no shared league data, no sign-in and no uploads. Nothing here pretends otherwise.
              </p>
              <ol style={{ fontSize: 13, lineHeight: 1.6 }}>
                <li>Create a Supabase project and run the migrations in <code>supabase/migrations</code> followed by <code>supabase/seed.sql</code>.</li>
                <li>Set <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> and <code>NEXT_PUBLIC_APP_ORIGIN</code> (see <code>.env.example</code>).</li>
                <li>Bootstrap the first commissioner with <code>npm run bootstrap:commissioner</code> using the server-only secret key.</li>
              </ol>
            </>
          ) : reason === "event" ? (
            <p>The database is reachable but the configured event slug has not been seeded. Run <code>supabase/seed.sql</code> against the project, or set <code>NEXT_PUBLIC_EVENT_SLUG</code> to the seeded event.</p>
          ) : (
            <p>The backend is configured. Sign in from the <Link href="/login">league access</Link> page.</p>
          )}
          <div className="pb-actions">
            <Link className="pb-secondary" href="/demo">Open the labelled demo</Link>
            <Link className="pb-secondary" href="/teaser">View the teaser</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
