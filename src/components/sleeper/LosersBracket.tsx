import { SleeperAvatar } from "@/components/sleeper/SleeperTeam";
import { SENTENCED_SEASON, type BracketSlot, type BracketTeam } from "@/lib/bracket";
import { STANDINGS } from "@/lib/programme";
import { loadLosersBracket, sleeperAvatarUrl, type LosersBracketData } from "@/lib/sleeper";

function Slot({ slot, sentenced }: { slot: BracketSlot; sentenced: BracketTeam | null }) {
  const t = slot.team;
  const isSentenced = Boolean(t && sentenced && t.rosterId === sentenced.rosterId);
  return (
    <div className={`pb-sl-row ${slot.result ?? "tbd"} ${isSentenced ? "sentenced" : ""}`.trim()}>
      {t ? <SleeperAvatar avatarUrl={sleeperAvatarUrl(t.avatar)} name={t.managerName} size={30} /> : <span className="pb-sl-avatar pb-sl-avatar-fallback pb-sl-avatar-empty" style={{ width: 30, height: 30 }} aria-hidden="true">?</span>}
      <span className="pb-sl-row-text">
        <b>{t ? t.teamName : (slot.from ?? "TBD")}</b>
        <small>{t ? `${t.username ? `@${t.username}` : t.managerName}${t.record ? ` · ${t.record}` : ""}` : "Awaiting result"}</small>
      </span>
      {isSentenced ? <span className="pb-sl-pill orange">SENTENCED</span> : slot.result === "win" ? <span className="pb-sl-result win">W</span> : slot.result === "loss" ? <span className="pb-sl-result loss">L</span> : null}
    </div>
  );
}

/** Fallback when Sleeper is unreachable and no snapshot exists: the bottom half of the supplied standings. */
function StandingsFallback() {
  const rows = STANDINGS.flatMap((d) => d.teams.map((t) => ({ ...t, division: d.division })))
    .sort((a, b) => a.overallRank - b.overallRank)
    .slice(-6);
  return (
    <div className="pb-sl-rounds">
      <div className="pb-sl-round" style={{ minWidth: 0, flex: 1 }}>
        <div className="pb-sl-round-label">FINAL STANDINGS · BOTTOM SIX</div>
        <div className="pb-sl-match">
          {rows.map((t) => (
            <div key={t.team} className={`pb-sl-row ${t.sentenced ? "sentenced" : "tbd"}`}>
              <span className="pb-sl-seed">{t.overallRank}</span>
              <span className="pb-sl-row-text">
                <b>{t.team}</b>
                <small>{t.manager} · {t.record} · {t.division}</small>
              </span>
              {t.sentenced ? <span className="pb-sl-pill orange">SENTENCED</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The road to Pofadder: the sentenced season's Sleeper losers bracket, styled the way Sleeper
 * draws it (dark card, avatars, W/L chips, rounds left to right). Streams in under Suspense so
 * the page never waits on the Sleeper API.
 */
export async function LosersBracketPanel({ leagueId, season = SENTENCED_SEASON }: { leagueId: string | null; season?: string }) {
  const sentencedManager = STANDINGS.flatMap((d) => d.teams).find((t) => t.sentenced)?.manager ?? null;
  const data = await loadLosersBracket(leagueId, season, sentencedManager);
  return <LosersBracketView data={data} season={season} />;
}

/** Presentation only, so previews and tests can hand it a bracket. */
export function LosersBracketView({ data, season }: { data: LosersBracketData | null; season: string }) {
  const sentenced = data?.bracket.sentenced ?? null;
  return (
    <section className="pb-sl pb-sl-bracket" aria-label={`${season} losers bracket`}>
      <div className="pb-sl-head">
        <span className="pb-sl-mark" aria-hidden="true">S</span>
        <div className="pb-sl-head-text">
          <b>TOILET BOWL · {season} LOSERS BRACKET</b>
          <small>{data ? `${data.leagueName} · ${data.bracket.teams} teams · ${data.source === "live" ? "from Sleeper" : "snapshot"}` : "Sleeper unavailable · final standings shown"}</small>
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
        <div className="pb-sl-rounds">
          {data.bracket.rounds.map((round) => (
            <div key={round.round} className="pb-sl-round">
              <div className="pb-sl-round-label">{round.label}</div>
              {round.matches.map((m) => (
                <div key={m.id} className="pb-sl-match">
                  <div className="pb-sl-match-label">
                    <span>M{m.id}</span>
                    {m.label}
                  </div>
                  <Slot slot={m.t1} sentenced={sentenced} />
                  <Slot slot={m.t2} sentenced={sentenced} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <StandingsFallback />
      )}
    </section>
  );
}
