import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamLogo, PbShield } from "@/components/ui/Marks";
import { isBackendConfigured } from "@/lib/env";
import { getVerifiedUser } from "@/lib/league";
import { LoginForm } from "./LoginForm";
import { LocalPasswordForm } from "./LocalPasswordForm";
import { isLocalStack } from "./local-actions";

export const metadata = { title: "League access" };
export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  if (!isBackendConfigured()) redirect("/setup");
  const { user } = await getVerifiedUser();
  if (user) redirect("/");
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";

  return (
    <div className="pb">
      <main className="pb-content" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="pb-title-row">
          <div>
            <div className="pb-kicker">PRIVATE LEAGUE ACCESS</div>
            <h1>Welcome to the consequences.</h1>
            <p>One league. Three roles. Everyone gets the right view.</p>
          </div>
        </div>
        <div className="pb-login pb-panel">
          <div className="pb-brand">
            <PbShield />
            POFADDER BOWL ’26
          </div>
          <h2>Your seat on the sideline.</h2>
          <div className="pb-login-logo-wall" aria-hidden="true">
            {["nyg", "kc", "cin", "phi", "det"].map((c) => (
              <TeamLogo key={c} code={c} decorative size={35} />
            ))}
          </div>
          {reason === "session" ? (
            <div className="pb-status" role="status">
              Your session has expired or you are not signed in. Request a fresh sign-in link below.
            </div>
          ) : null}
          {reason === "invalid" ? (
            <div className="pb-status" role="status" style={{ borderLeftColor: "#b3392a" }}>
              That sign-in link was invalid or has already been used. Request a new one.
            </div>
          ) : null}
          <LoginForm next={next} />
          {(await isLocalStack()) ? <LocalPasswordForm next={next} /> : null}
          <p className="pb-small" style={{ marginTop: 14 }}>
            Invite-only. Sign-in links go to the email address the commissioner invited. Sleeper is the league host but does not offer sign-in for third-party apps, so your Sleeper identity is linked in your account after you sign in.
          </p>
          <p className="pb-small" style={{ marginTop: 10 }}>
            Just looking? <Link href="/demo">Open the labelled demo</Link> or <Link href="/teaser">see the teaser</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
