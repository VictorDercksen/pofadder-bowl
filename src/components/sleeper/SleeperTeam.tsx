import Image from "next/image";

/** Sleeper-style round avatar: the manager's Sleeper picture, or their initials on the dark card. */
export function SleeperAvatar({ avatarUrl, name, size = 28 }: { avatarUrl: string | null; name: string; size?: number }) {
  const initials = name
    .replace(/^@/, "")
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (avatarUrl) return <Image className="pb-sl-avatar" src={avatarUrl} alt="" width={size} height={size} style={{ width: size, height: size }} unoptimized />;
  return (
    <span className="pb-sl-avatar pb-sl-avatar-fallback" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {initials || "S"}
    </span>
  );
}

export type SleeperTeamProps = { teamName: string | null; displayName: string; username: string | null; avatarUrl: string | null };

/** Header chip: team name in bold with the manager handle beneath, on Sleeper's dark card. */
export function SleeperTeamChip({ teamName, displayName, username, avatarUrl, size = 30 }: SleeperTeamProps & { size?: number }) {
  const handle = username ? `@${username}` : displayName;
  return (
    <span className="pb-sl-chip" title={`Sleeper · ${teamName ?? displayName} · ${handle}`}>
      <SleeperAvatar avatarUrl={avatarUrl} name={displayName} size={size} />
      <span className="pb-sl-chip-text">
        <b>{teamName ?? displayName}</b>
        <small>{handle}</small>
      </span>
    </span>
  );
}

/** Larger card for League access and the picker. */
export function SleeperTeamCard({ teamName, displayName, username, avatarUrl, confirmed, selected, taken, tag }: SleeperTeamProps & { confirmed?: boolean; selected?: boolean; taken?: string | null; tag?: string }) {
  const handle = username ? `@${username}` : displayName;
  return (
    <span className={`pb-sl-card ${selected ? "selected" : ""} ${taken ? "taken" : ""}`.trim()}>
      <SleeperAvatar avatarUrl={avatarUrl} name={displayName} size={44} />
      <span className="pb-sl-card-text">
        <b>{teamName ?? displayName}</b>
        <small>
          {handle}
          {teamName && displayName.toLowerCase() !== (username ?? "").toLowerCase() ? ` · ${displayName}` : ""}
        </small>
        {taken ? <em>Taken by {taken}</em> : null}
      </span>
      {tag ? <span className="pb-sl-pill">{tag}</span> : confirmed ? <span className="pb-sl-pill on">CONFIRMED</span> : null}
    </span>
  );
}
