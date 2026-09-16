import { TeamLogo } from "@/components/ui/Marks";
import { TitleRow } from "@/components/ui/TitleRow";
import { KitPanel } from "@/components/ui/KitPanel";
import { BingoBoard } from "@/components/bingo/BingoBoard";
import { getLeagueContext } from "@/lib/league";
import { teamName } from "@/lib/nfl";
import { formatTime } from "@/lib/time";

export const metadata = { title: "Punishment Bingo" };

export default async function BingoPage() {
  const ctx = await getLeagueContext();
  const tz = ctx.event.timezone;
  const { data: card, error: cardError } = await ctx.supabase.rpc("ensure_bingo_card", { p_event: ctx.event.id });
  const [{ data: squares }, { data: incidents }, { data: leaderboard }, { data: wins }, { data: profiles }] = await Promise.all([
    ctx.supabase.from("bingo_squares").select("*").eq("event_id", ctx.event.id).order("position"),
    ctx.supabase.from("bingo_incidents").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false }),
    ctx.supabase.rpc("bingo_leaderboard", { p_event: ctx.event.id }),
    ctx.supabase.from("bingo_wins").select("*").eq("event_id", ctx.event.id).eq("user_id", ctx.user.id),
    ctx.supabase.from("profiles").select("id, display_name, kit_team"),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  if (cardError || !card || !squares) {
    return (
      <>
        <TitleRow kicker="LEAGUE SIDE QUEST" title="Misery loves company." tag="BINGO" team={ctx.profile.kit_team} />
        <div className="pb-status" role="alert" style={{ borderLeftColor: "#b3392a" }}>
          Your bingo card could not be created ({cardError?.message ?? "no squares seeded"}). Refresh, or ask the commissioner to check the event seed.
        </div>
      </>
    );
  }

  const confirmedPositions = new Set((incidents ?? []).filter((i) => i.status === "confirmed").map((i) => squares.find((s) => s.id === i.square_id)?.position).filter((p): p is number => p != null));
  const proposedSquareIds = new Set((incidents ?? []).filter((i) => i.status === "proposed").map((i) => i.square_id));
  const myLines = (wins ?? []).filter((w) => w.line_key !== "full_house");
  const marked = [...confirmedPositions].filter((p) => card.layout.includes(p)).length;

  return (
    <>
      <TitleRow kicker="LEAGUE SIDE QUEST" title="Misery loves company." blurb="Your card. His misfortune. Five in a row wins." tag={myLines.length ? `BINGO · ${myLines.length} LINE${myLines.length === 1 ? "" : "S"}` : "PERSONAL BINGO CARD"} team={ctx.profile.kit_team} />
      <div className="pb-split">
        <KitPanel team={ctx.profile.kit_team} name={`${ctx.profile.display_name}’s card`} kicker={`${teamName(ctx.profile.kit_team ?? "nfl").toUpperCase()} · ${marked}/25 MARKED`}>
          <BingoBoard
            layout={card.layout}
            squares={squares.map((s) => ({ id: s.id, position: s.position, text: s.text, is_free: s.is_free }))}
            confirmedPositions={[...confirmedPositions]}
            proposedSquareIds={[...proposedSquareIds]}
            isCommissioner={ctx.isCommissioner}
            incidents={(incidents ?? []).filter((i) => i.status === "proposed").map((i) => ({ id: i.id, square_id: i.square_id, note: i.note, proposed_by: names.get(i.proposed_by ?? "") ?? "member", created_at: formatTime(i.created_at, tz) }))}
          />
          <p className="pb-small" style={{ marginTop: 12 }}>
            Tap a square to propose an incident. Confirmed incidents mark everyone’s matching squares; rows, columns, diagonals and full house are detected on the server. Your layout is fixed for the event.
          </p>
        </KitPanel>
        <div>
          <div className="pb-panel">
            <h3>The misery leaderboard</h3>
            {(leaderboard ?? []).length === 0 ? <p className="pb-small">No cards yet.</p> : null}
            {(leaderboard ?? []).map((row, i) => (
              <div className="pb-rank" key={row.user_id}>
                <b className="pb-ranking-num">{i + 1}</b>
                <TeamLogo code={row.kit_team} decorative size={30} />
                <div>
                  {row.display_name}
                  <br />
                  <small className="pb-small">{row.full_house_at ? `Full house · ${formatTime(row.full_house_at, tz)}` : row.first_line_at ? `First bingo · ${formatTime(row.first_line_at, tz)}` : row.marked >= 24 ? "One square away" : "Dignity prepaid"}</small>
                </div>
                <span>{row.lines ? `${row.lines} line${row.lines === 1 ? "" : "s"}` : `${row.marked}/25`}</span>
              </div>
            ))}
          </div>
          <div className="pb-next">
            <h3>Incident booth</h3>
            <p>
              {(incidents ?? []).filter((i) => i.status === "confirmed").length} confirmed · {(incidents ?? []).filter((i) => i.status === "proposed").length} proposed
              {ctx.isCommissioner ? " · confirm or reject on the card." : " · commissioners confirm incidents."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
