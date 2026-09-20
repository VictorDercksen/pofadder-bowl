import Link from "next/link";
import { SleeperAvatar } from "@/components/sleeper/SleeperTeam";
import { TeamLogo } from "@/components/ui/Marks";

export type DrawerIdentityProps = {
  name: string;
  kitTeam: string | null;
  kitNumber: number | null;
  /** Small gold line under the name (roles, or a demo note). */
  roleLabel: string;
  /** Linked Sleeper manager; null shows a muted placeholder. */
  sleeper: { teamName: string | null; displayName: string; avatarUrl: string | null } | null;
  /** Where the block links to; omit for a static block (demo). */
  href?: string;
};

/**
 * Member insignia at the top of the mobile drawer: kit badge with the jersey number pinned to
 * its corner, name, Sleeper team, and a one-line role kicker. Nothing is repeated: the logo
 * says the franchise, the badge says the number, the handle is left to the account page.
 */
export function DrawerIdentity({ name, kitTeam, kitNumber, roleLabel, sleeper, href }: DrawerIdentityProps) {
  const body = (
    <>
      <span className="pb-drawer-mark">
        <TeamLogo code={kitTeam} size={54} decorative />
        {kitTeam && kitNumber != null ? <span className="pb-drawer-number">#{String(kitNumber).padStart(2, "0")}</span> : null}
      </span>
      <span className="pb-drawer-id-text">
        <b>{name}</b>
        <span className="pb-drawer-id-sub">
          {sleeper ? (
            <>
              <SleeperAvatar avatarUrl={sleeper.avatarUrl} name={sleeper.displayName} size={18} />
              <strong>{sleeper.teamName ?? sleeper.displayName}</strong>
            </>
          ) : (
            <em>{kitTeam ? "No Sleeper team yet" : "No kit or Sleeper team yet"}</em>
          )}
        </span>
        <small>{roleLabel}</small>
      </span>
    </>
  );
  const label = `${name}, account, kit and Sleeper team`;
  return href ? (
    <Link href={href} className="pb-drawer-identity" aria-label={label} data-tour="drawer-identity">
      {body}
    </Link>
  ) : (
    <div className="pb-drawer-identity" data-tour="drawer-identity">
      {body}
    </div>
  );
}
