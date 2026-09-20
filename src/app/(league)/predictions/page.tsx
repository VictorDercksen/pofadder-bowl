import { TitleRow } from "@/components/ui/TitleRow";
import { KitPanel } from "@/components/ui/KitPanel";
import { MemberBadge } from "@/components/ui/Marks";
import { RatingBadge, RatingSelector } from "@/components/ui/RatingSelector";
import { PredictionSlip, RulesEditor } from "@/components/predictions/PredictionSlip";
import { getLeagueContext } from "@/lib/league";
import { DEFAULT_RULES, formatMetric, METRIC_SHORT, METRICS, type PredictionRules, type PredictionValues } from "@/lib/predictions";
import { formatDateTime, formatTime, nowMs } from "@/lib/time";

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
  const r: PredictionRules = rules ?? DEFAULT_RULES;
  const pick = (row: PredictionValues | Record<string, unknown>): PredictionValues => Object.fromEntries(METRICS.map((m) => [m.column, (row as Record<string, unknown>)[m.column] ?? null])) as PredictionValues;
  const calls = (row: PredictionValues) => METRICS.map((m) => `${METRIC_SHORT[m.key]} ${formatMetric(m.key, row[m.column])}`).join(" · ");
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const kits = new Map((profiles ?? []).map((p) => [p.id, p.kit_team]));
  const totals = new Map<string, number>();
  for (const a of awards ?? []) totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + a.points);

  return (
    <>
      <TitleRow kicker={`PREGAME VIEW · LOCKS ${formatDateTime(ctx.event.prediction_lock_at, tz).toUpperCase()}`} title="Call it before kickoff." blurb="Predictions lock at departure. The top slip wins 5 FAAB in Sleeper." tag={locked ? "LOCKED" : `LOCKS AT ${formatTime(ctx.event.prediction_lock_at, tz)}`} team={ctx.profile.kit_team} />
      <div className="pb-split">
        <KitPanel team={ctx.profile.kit_team} name="The prediction slip" kicker={`${ctx.profile.display_name.toUpperCase()} · #${String(ctx.profile.kit_number).padStart(2, "0")}`} tour="prediction-slip">
          <PredictionSlip locked={locked} lockAt={ctx.event.prediction_lock_at} existing={mine ? pick(mine) : null} />
          {revealed ? (
            <div style={{ marginTop: 18 }}>
              <h3>The league’s calls</h3>
              {(all ?? []).map((p) => (
                <div className="pb-challenge" key={p.user_id ?? ""}>
                  <span className="pb-num">{totals.get(p.user_id ?? "") ?? 0}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong><MemberBadge code={p.kit_team} name={p.display_name ?? "member"} size={22} /> · <RatingBadge value={p.meal_rating} /></strong>
                    <p>{calls(pick(p))}</p>
                  </div>
                </div>
              ))}
              {(all ?? []).length === 0 ? <p className="pb-small">No slips were submitted.</p> : null}
            </div>
          ) : (
            <p className="pb-small" style={{ marginTop: 14 }}>Other members’ answers are hidden until {formatDateTime(ctx.event.prediction_reveal_at, tz)}.</p>
          )}
        </KitPanel>
        <div className="pb-panel">
          <h3>How the points work</h3>
          {METRICS.map((m) => (
            <div className="pb-challenge" key={m.key}>
              <span className="pb-num">{r[`${m.key}_points`]}</span>
              <div>
                <strong>{m.label}</strong>
                <p>{m.blurb}</p>
              </div>
            </div>
          ))}
          <div className="pb-next">
            <h3>Equal guesses share the glory.</h3>
            <p>Tied winners receive the same points. Results appear once the commissioner enters official results and resolves the slips. Separate from Victor’s 100-point punishment score.</p>
          </div>
          <div className="pb-next">
            <div className="pb-kicker">THE STAKES</div>
            <h3>5 FAAB in Sleeper.</h3>
            <p>The highest-scoring slip takes 5 FAAB, added to the winner’s Sleeper waiver budget by the commissioner after the trip. A tie at the top shares it. The prop board winner takes the other 5. No cash stakes.</p>
          </div>
          {results?.resolved_at ? (
            <div style={{ marginTop: 16 }}>
              <h3>Official results</h3>
              <p className="pb-small">{calls(pick(results))}</p>
              <RatingSelector value={results.meal_rating} label="Official chicken and rib combo rating" readOnly size="small" caption="official" />
              {[...totals.entries()].sort((a, b) => b[1] - a[1]).map(([uid, pts], i) => (
                <div className="pb-rank" key={uid}>
                  <b className="pb-ranking-num">{i + 1}</b>
                  <div><MemberBadge code={kits.get(uid)} name={names.get(uid) ?? "member"} size={24} /></div>
                  <span>{pts}</span>
                </div>
              ))}
            </div>
          ) : null}
          {ctx.isAdmin && !locked ? <RulesEditor rules={Object.fromEntries(METRICS.map((m) => [`${m.key}_points`, r[`${m.key}_points`]])) as PredictionRules} /> : null}
        </div>
      </div>
    </>
  );
}
