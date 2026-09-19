import { TitleRow } from "@/components/ui/TitleRow";
import { KitPanel } from "@/components/ui/KitPanel";
import { MemberBadge } from "@/components/ui/Marks";
import { PredictionSlip, RulesEditor } from "@/components/predictions/PredictionSlip";
import { getLeagueContext } from "@/lib/league";
import { DEFAULT_RULES } from "@/lib/predictions";
import { formatDateTime, formatTime, nowMs, secondsToClock } from "@/lib/time";

export const metadata = { title: "Predictions" };

export default async function PredictionsPage() {
  const ctx = await getLeagueContext();
  const tz = ctx.event.timezone;
  const now = nowMs();
  const locked = now >= Date.parse(ctx.event.prediction_lock_at);
  const revealed = now >= Date.parse(ctx.event.prediction_reveal_at);
  const [{ data: mine }, { data: rules }, { data: all }, { data: results }, { data: awards }, { data: profiles }] = await Promise.all([
    ctx.supabase.from("predictions").select("*").eq("event_id", ctx.event.id).eq("user_id", ctx.user.id).maybeSingle(),
    ctx.supabase.from("prediction_rules").select("*").eq("event_id", ctx.event.id).maybeSingle(),
    ctx.supabase.from("predictions_revealed").select("*").eq("event_id", ctx.event.id),
    ctx.supabase.from("official_results").select("*").eq("event_id", ctx.event.id).maybeSingle(),
    ctx.supabase.from("prediction_awards").select("*").eq("event_id", ctx.event.id),
    ctx.supabase.from("profiles").select("id, display_name, kit_team"),
  ]);
  const r = rules ?? { ...DEFAULT_RULES, event_id: ctx.event.id, updated_at: "" };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const kits = new Map((profiles ?? []).map((p) => [p.id, p.kit_team]));
  const totals = new Map<string, number>();
  for (const a of awards ?? []) totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + a.points);

  return (
    <>
      <TitleRow kicker={`PREGAME VIEW · LOCKS ${formatDateTime(ctx.event.prediction_lock_at, tz).toUpperCase()}`} title="Call it before kickoff." blurb="Predictions lock at departure. Bragging rights are the only currency." tag={locked ? "LOCKED" : `LOCKS AT ${formatTime(ctx.event.prediction_lock_at, tz)}`} team={ctx.profile.kit_team} />
      <div className="pb-split">
        <KitPanel team={ctx.profile.kit_team} name="The prediction slip" kicker={`${ctx.profile.display_name.toUpperCase()} · #${String(ctx.profile.kit_number).padStart(2, "0")}`} tour="prediction-slip">
          <PredictionSlip locked={locked} lockAt={ctx.event.prediction_lock_at} existing={mine ? { run_seconds: mine.run_seconds, meal_rating: mine.meal_rating, complaint_count: mine.complaint_count } : null} />
          {revealed ? (
            <div style={{ marginTop: 18 }}>
              <h3>The league’s calls</h3>
              <table className="pb-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Run</th>
                    <th>Meal</th>
                    <th>Complaints</th>
                    <th className="num">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {(all ?? []).map((p) => (
                    <tr key={p.user_id ?? ""}>
                      <td><MemberBadge code={p.kit_team} name={p.display_name ?? "member"} size={22} /></td>
                      <td>{secondsToClock(p.run_seconds ?? 0)}</td>
                      <td>{p.meal_rating} / 10</td>
                      <td>{p.complaint_count}</td>
                      <td className="num">{totals.get(p.user_id ?? "") ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(all ?? []).length === 0 ? <p className="pb-small">No slips were submitted.</p> : null}
            </div>
          ) : (
            <p className="pb-small" style={{ marginTop: 14 }}>Other members’ answers are hidden until {formatDateTime(ctx.event.prediction_reveal_at, tz)}.</p>
          )}
        </KitPanel>
        <div className="pb-panel">
          <h3>How the points work</h3>
          <div className="pb-challenge">
            <span className="pb-num">{r.run_points}</span>
            <div>
              <strong>Closest run time</strong>
              <p>Measured against the approved watch export.</p>
            </div>
          </div>
          <div className="pb-challenge">
            <span className="pb-num">{r.meal_points}</span>
            <div>
              <strong>Exact meal rating</strong>
              <p>Victor’s on-camera verdict is final.</p>
            </div>
          </div>
          <div className="pb-challenge">
            <span className="pb-num">{r.complaints_points}</span>
            <div>
              <strong>Closest complaint count</strong>
              <p>Commissioner counts distinct recorded complaints.</p>
            </div>
          </div>
          <div className="pb-next">
            <h3>Equal guesses share the glory.</h3>
            <p>Tied winners receive the same points. Results appear once the commissioner enters official results and resolves the slips. Separate from Victor’s 100-point punishment score. No cash stakes.</p>
          </div>
          {results?.resolved_at ? (
            <div style={{ marginTop: 16 }}>
              <h3>Official results</h3>
              <p className="pb-small">
                Run {results.run_seconds != null ? secondsToClock(results.run_seconds) : "—"} · meal {results.meal_rating ?? "—"} / 10 · {results.complaint_count ?? "—"} complaints
              </p>
              {[...totals.entries()].sort((a, b) => b[1] - a[1]).map(([uid, pts], i) => (
                <div className="pb-rank" key={uid}>
                  <b className="pb-ranking-num">{i + 1}</b>
                  <div><MemberBadge code={kits.get(uid)} name={names.get(uid) ?? "member"} size={24} /></div>
                  <span>{pts}</span>
                </div>
              ))}
            </div>
          ) : null}
          {ctx.isAdmin && !locked ? <RulesEditor rules={{ run_points: r.run_points, meal_points: r.meal_points, complaints_points: r.complaints_points }} /> : null}
        </div>
      </div>
    </>
  );
}
