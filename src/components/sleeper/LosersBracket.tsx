import { SleeperAvatar } from "@/components/sleeper/SleeperTeam";
import { SENTENCED_SEASON, formatPoints, type Bracket, type BracketItem, type BracketMatch, type BracketSlot, type BracketTeam } from "@/lib/bracket";
import { STANDINGS } from "@/lib/programme";
import { loadLosersBracket, sleeperAvatarUrl, type LosersBracketData } from "@/lib/sleeper";

const isSentenced = (t: BracketTeam | null, sentenced: BracketTeam | null) => Boolean(t && sentenced && t.rosterId === sentenced.rosterId);

/** One side of a matchup: avatar, team, handle and record, the week's points and the scoreboard result. */
function Row({ slot, sentenced }: { slot: BracketSlot; sentenced: BracketTeam | null }) {
  const t = slot.team;
  const marked = isSentenced(t, sentenced);
  return (
    <div className={`pb-tb-row ${slot.result ?? "tbd"} ${marked ? "sentenced" : ""}`.trim()}>
      {t ? <SleeperAvatar avatarUrl={sleeperAvatarUrl(t.avatar)} name={t.managerName} size={32} /> : <span className="pb-sl-avatar pb-sl-avatar-fallback pb-sl-avatar-empty" style={{ width: 32, height: 32 }} aria-hidden="true">?</span>}
      <span className="pb-tb-row-text">
        <b>{t ? t.teamName : (slot.from ?? "TBD")}</b>
        <small>
          <span className="pb-tb-handle">{t ? `${t.username ? `@${t.username}` : t.managerName}${t.record && !marked ? ` · ${t.record}` : ""}` : "Awaiting result"}</span>
          {marked ? <em className="pb-tb-tag">Sentenced</em> : null}
        </small>
      </span>
      {t && (slot.points != null || slot.result) ? (
        <span className={`pb-tb-score ${slot.result ?? ""}`.trim()} aria-label={slot.points != null ? `${formatPoints(slot.points)} points` : undefined}>
          {formatPoints(slot.points)}
        </span>
      ) : null}
      {slot.result ? <span className={`pb-tb-result ${slot.result}`} aria-label={slot.result === "win" ? "Won on points" : "Lost on points"}>{slot.result === "win" ? "W" : "L"}</span> : null}
    </div>
  );
}

function MatchCard({ match, sentenced, showWeek = false }: { match: BracketMatch; sentenced: BracketTeam | null; showWeek?: boolean }) {
  const isFinal = match.place === 1;
  return (
    <div className={`pb-tb-card ${isFinal ? "final" : ""}`.trim()}>
      <div className="pb-tb-card-label">
        <span>M{match.id}</span>
        {isFinal ? <i className="pb-tb-crown" aria-hidden="true">♛</i> : null}
        {match.label}
        {isFinal ? <em>· Bound for Pofadder</em> : showWeek && match.week != null ? <em>· Week {match.week}</em> : null}
      </div>
      <Row slot={match.t1} sentenced={sentenced} />
      <Row slot={match.t2} sentenced={sentenced} />
    </div>
  );
}

/** A top seed that skipped round 1, drawn where Sleeper draws it: in the first column. */
function ByeCard({ team, sentenced }: { team: BracketTeam; sentenced: BracketTeam | null }) {
  const marked = isSentenced(team, sentenced);
  return (
    <div className="pb-tb-card bye">
      <div className={`pb-tb-row tbd ${marked ? "sentenced" : ""}`.trim()}>
        <SleeperAvatar avatarUrl={sleeperAvatarUrl(team.avatar)} name={team.managerName} size={32} />
        <span className="pb-tb-row-text">
          <b>{team.teamName}</b>
          <small>
            <span className="pb-tb-handle">
              {team.username ? `@${team.username}` : team.managerName}
              {team.record && !marked ? ` · ${team.record}` : ""}
            </span>
            {marked ? <em className="pb-tb-tag">Sentenced</em> : null}
          </small>
        </span>
        <span className="pb-tb-bye">BYE</span>
      </div>
    </div>
  );
}

function Item({ item, sentenced }: { item: BracketItem; sentenced: BracketTeam | null }) {
  return item.kind === "bye" ? <ByeCard team={item.team} sentenced={sentenced} /> : <MatchCard match={item.match} sentenced={sentenced} />;
}

/**
 * The main tree. When every round halves the one before it, the rounds go on a grid whose rows
 * are the first-round slots; a later card spans its two feeders so the connector lines meet its
 * centre. Irregular shapes fall back to plain columns. DOM order is label, cards, label, cards so
 * the same markup stacks vertically on phones.
 */
function Tree({ bracket, sentenced }: { bracket: Bracket; sentenced: BracketTeam | null }) {
  const rounds = bracket.rounds;
  const cols = rounds.length;
  const leaves = rounds[0]?.items.length ?? 0;
  if (!bracket.regular) {
    return (
      <div className="pb-tb-cols" style={{ ["--tb-cols" as string]: cols }}>
        {rounds.map((round) => (
          <div key={round.round} className="pb-tb-col">
            <RoundLabel label={round.label} week={round.week} />
            {round.items.map((item) => (
              <Item key={item.kind === "bye" ? `bye-${item.team.rosterId}` : `m-${item.match.id}`} item={item} sentenced={sentenced} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="pb-tb-grid" style={{ ["--tb-cols" as string]: cols, ["--tb-rows" as string]: leaves }}>
      {rounds.map((round, k) => {
        const span = 2 ** k;
        return [
          <RoundLabel key={`label-${round.round}`} label={round.label} week={round.week} style={{ gridColumn: k + 1, gridRow: 1 }} />,
          ...round.items.map((item, j) => (
            <div
              key={item.kind === "bye" ? `bye-${item.team.rosterId}` : `m-${item.match.id}`}
              className={`pb-tb-cell ${k > 0 ? "in" : ""} ${k < cols - 1 ? "out" : ""}`.trim()}
              style={{ gridColumn: k + 1, gridRow: `${2 + j * span} / span ${span}` }}
            >
              <Item item={item} sentenced={sentenced} />
            </div>
          )),
        ];
      })}
    </div>
  );
}

function RoundLabel({ label, week, style }: { label: string; week: number | null; style?: React.CSSProperties }) {
  return (
    <div className="pb-tb-round-label" style={style}>
      {label}
      {week != null ? <small>Week {week}</small> : null}
    </div>
  );
}

/** Fallback when Sleeper is unreachable and no snapshot exists: the bottom half of the supplied standings. */
function StandingsFallback() {
  const rows = STANDINGS.flatMap((d) => d.teams.map((t) => ({ ...t, division: d.division })))
    .sort((a, b) => a.overallRank - b.overallRank)
    .slice(-6);
  return (
    <div className="pb-tb-placement">
      <div className="pb-tb-round-label">Final standings <small>Bottom six</small></div>
      <div className="pb-tb-card">
        {rows.map((t) => (
          <div key={t.team} className={`pb-tb-row tbd ${t.sentenced ? "sentenced" : ""}`.trim()}>
            <span className="pb-tb-seed">{t.overallRank}</span>
            <span className="pb-tb-row-text">
              <b>{t.team}</b>
              <small>
                <span className="pb-tb-handle">{t.manager} · {t.record} · {t.division}</span>
                {t.sentenced ? <em className="pb-tb-tag">Sentenced</em> : null}
              </small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The road to Pofadder: the sentenced season's Sleeper losers bracket, drawn the way Sleeper draws
 * it (dark card, rounds by week left to right, byes in the first column, connector lines, points per
 * matchup) in this app's type and colours. Streams in under Suspense so the page never waits on
 * the Sleeper API.
 */
export async function LosersBracketPanel({ leagueId, season = SENTENCED_SEASON }: { leagueId: string | null; season?: string }) {
  const sentencedManager = STANDINGS.flatMap((d) => d.teams).find((t) => t.sentenced)?.manager ?? null;
  const data = await loadLosersBracket(leagueId, season, sentencedManager);
  return <LosersBracketView data={data} season={season} />;
}

/** Presentation only, so previews and tests can hand it a bracket. */
export function LosersBracketView({ data, season }: { data: LosersBracketData | null; season: string }) {
  const sentenced = data?.bracket.sentenced ?? null;
  const weeks = data?.bracket.rounds.map((r) => r.week).filter((w): w is number => w != null) ?? [];
  const weekSpan = weeks.length ? ` · Weeks ${Math.min(...weeks)}–${Math.max(...weeks)}` : "";
  return (
    <section className="pb-sl pb-sl-bracket" aria-label={`${season} losers bracket`}>
      <div className="pb-sl-head">
        <span className="pb-sl-mark" aria-hidden="true">S</span>
        <div className="pb-sl-head-text">
          <b>TOILET BOWL · {season} LOSERS BRACKET</b>
          <small>{data ? `${data.leagueName} · ${data.bracket.teams} teams${weekSpan} · ${data.source === "live" ? "from Sleeper" : "Sleeper snapshot"} · lose and you advance` : "Sleeper unavailable · final standings shown"}</small>
        </div>
        {sentenced ? (
          <span className="pb-sl-head-sentenced">
            <SleeperAvatar avatarUrl={sleeperAvatarUrl(sentenced.avatar)} name={sentenced.managerName} size={26} />
            <span>
              <b>{sentenced.teamName}</b>
              <small>Bound for Pofadder</small>
            </span>
          </span>
        ) : null}
      </div>
      {data ? (
        <>
          <div className="pb-tb-scroll">
            <Tree bracket={data.bracket} sentenced={sentenced} />
          </div>
          {data.bracket.placement.length ? (
            <div className="pb-tb-placement">
              <div className="pb-tb-round-label">Placement games <small>Who finished where</small></div>
              <div className="pb-tb-placement-grid">
                {data.bracket.placement.map((m) => (
                  <MatchCard key={m.id} match={m} sentenced={sentenced} showWeek />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <StandingsFallback />
      )}
    </section>
  );
}
