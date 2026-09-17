import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { TeamLogo } from "@/components/ui/Marks";
import { DrawerIdentity } from "@/components/shell/DrawerIdentity";
import { DemoProvider } from "@/components/demo/DemoStore";

export const metadata = { title: "Interactive demo", robots: { index: false } };

/**
 * Demo mode: an isolated, in-memory replica of the approved mockup. Nothing here reads or
 * writes the backend, and nothing here grants access to the private league.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <AppShell
        role="demo"
        base="/demo"
        badge={<span className="pb-demo">INTERACTIVE DEMO</span>}
        account={
          <>
            <TeamLogo code="nyg" size={36} />
            <span className="name">Demo member</span>
            <Link href="/login" className="pb-text-action">Real sign-in</Link>
          </>
        }
        drawerIdentity={<DrawerIdentity name="Demo member" kitTeam="nyg" kitNumber={7} roleLabel="Interactive demo" sleeper={{ teamName: "Big Blue Wrecking Crew", displayName: "Demo member", avatarUrl: null }} />}
        drawerFooter={<Link href="/login" className="pb-text-action">Real league sign-in</Link>}
        footerNote="Sample activity · Team marks: ESPN · No GPS or account connection · Nothing is saved"
      >
        <div className="pb-demo-banner">
          DEMO MODE · Sample data only. Taps here never touch the league backend, never award real points and never prompt for your location.
        </div>
        {children}
      </AppShell>
    </DemoProvider>
  );
}
