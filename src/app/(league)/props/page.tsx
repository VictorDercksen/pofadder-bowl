import { MemberBadge } from "@/components/ui/Marks";
import { TitleRow } from "@/components/ui/TitleRow";
import { KitPanel } from "@/components/ui/KitPanel";
import { Countdown } from "@/components/ui/Countdown";
import { PropBoard, type BoardProp } from "@/components/props/PropBoard";
import { PropLive } from "@/components/props/PropLive";
import { getLeagueContext } from "@/lib/league";
import { formatLine, isPropLocked, sortStandings, type PropResult, type PropSide } from "@/lib/props";
import { formatDateTime, formatTime, nowMs } from "@/lib/time";

export const metadata = { title: "Prop board" };

export default async function PropsPage() {
  const ctx = await getLeagueContext();
  const tz = ctx.event.timezone;
  const now = new Date(nowMs());
  const [{ data: props, error: propsError }, { data: picks }, { data: standings }, { data: profiles }] = await Promise.all([
    ctx.supabase.from("props").select("*").eq("event_id", ctx.event.id).order("sequence"),
    // RLS returns only the caller's picks until a prop locks, then everyone's.
    ctx.supabase.from("prop_picks").select("prop_id, user_id, side").eq("event_id", ctx.event.id),
    ctx.supabase.rpc("prop_leaderboard", { p_event: ctx.event.id }),
    ctx.supabase.from("profiles").select("id, display_name, kit_team"),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  if (propsError || !props || props.length === 0) {
    return (
      <>
        <TitleRow kicker="LEAGUE SIDE QUEST" title="Call the damage." tag="PROP BOARD" team={ctx.profile.kit_team} />
        <div className="pb-status" role="alert" style={{ borderLeftColor: "#b3392a" }}>
          {propsError ? `The prop board could not load (${propsError.message}).` : "No props are set for this event yet. Ask the commissioner to check the event seed."}
        </div>
      </>
    );
  }

  const board: BoardProp[] = props.map((p) => {
    const locked = isPropLocked(p.locks_at, now);
    const mine = (picks ?? []).find((k) => k.prop_id === p.id && k.user_id === ctx.user.id)?.side ?? null;
    const grouped: Partial<Record<PropSide, string[]>> = {};
    if (locked) {
      for (const k of (picks ?? []).filter((k) => k.prop_id === p.id)) {
        (grouped[k.side as PropSide] ??= []).push(names.get(k.user_id) ?? "member");
      }
    }
    return {
      id: p.id,
      sequence: p.sequence,
      title: p.title,
      detail: p.detail,
      kind: p.kind,
      line: formatLine(p.line, p.unit),
      locked,
      locksAt: p.locks_at,
      result: (p.result as PropResult | null) ?? null,
      mine: mine as PropSide | null,
      picks: locked ? grouped : null,
    };
  });
  const firstLock = board.reduce((min, p) => (p.locksAt < min ? p.locksAt : min), board[0].locksAt);
  const allLocked = board.every((p) => p.locked);
  const settled = board.filter((p) => p.result != null).length;
  const myPicks = board.filter((p) => p.mine).length;
  const myCorrect = board.filter((p) => p.result && p.result !== "void" && p.result === p.mine).length;
  const rows = sortStandings(standings ?? []);

  return (
    <>
      <PropLive eventId={ctx.event.id} />
      <TitleRow
        kicker={`LEAGUE SIDE QUEST · ${allLocked ? "BOARD LOCKED" : `LOCKS ${formatDateTime(firstLock, tz).toUpperCase()}`}`}
        title="Call the damage."
        blurb="Ten props on Victor’s trip. Pick a side on each before departure. Most correct calls wins 5 FAAB in Sleeper."
        tag={allLocked ? (settled ? `${settled}/${board.length} SETTLED` : "LOCKED") : `LOCKS AT ${formatTime(firstLock, tz)}`}
        team={ctx.profile.kit_team}
      />
      <div className="pb-split">
        <KitPanel team={ctx.profile.kit_team} name="The prop board" kicker={`${ctx.profile.display_name.toUpperCase()} · ${allLocked ? `${myCorrect} CORRECT OF ${settled} SETTLED` : `${myPicks}/${board.length} PICKED`}`}>
          <PropBoard props={board} isCommissioner={ctx.isCommissioner} />
          <p className="pb-small" style={{ marginTop: 12 }}>
            {allLocked ? "The board is locked. A commissioner settles each prop from the record after the trip." : <>Picks can be changed until the board locks (<Countdown targetIso={firstLock} passedLabel="locked" />). Other members’ picks show once it locks.</>}
          </p>
        </KitPanel>
        <div>
          <div className="pb-panel">
            <h3>Standings</h3>
            {rows.length === 0 ? <p className="pb-small">No picks yet.</p> : null}
            {rows.map((row, i) => (
              <div className="pb-rank" key={row.user_id}>
                <b className="pb-ranking-num">{i + 1}</b>
                <div><MemberBadge code={row.kit_team} name={row.display_name ?? "member"} size={24} /></div>
                <span>{settled ? `${row.correct} correct · ${row.wrong} wrong` : `${row.picks}/${board.length} picked`}</span>
              </div>
            ))}
          </div>
          <div className="pb-panel" style={{ marginTop: 15 }}>
            <h3>How it works</h3>
            <div className="pb-challenge">
              <span className="pb-num">1</span>
              <div>
                <strong>One point per correct call</strong>
                <p>Over/under props settle against the line. Yes/no props settle on the record.</p>
              </div>
            </div>
            <div className="pb-challenge">
              <span className="pb-num">0</span>
              <div>
                <strong>Void props score nothing</strong>
                <p>If the record cannot decide a prop, the commissioner voids it for everyone.</p>
              </div>
            </div>
            <div className="pb-next">
              <div className="pb-kicker">THE STAKES</div>
              <h3>5 FAAB in Sleeper.</h3>
              <p>The most correct calls take 5 FAAB, added to the winner’s Sleeper waiver budget by the commissioner after the trip. A tie at the top shares it. The prediction winner takes the other 5. No cash stakes.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
