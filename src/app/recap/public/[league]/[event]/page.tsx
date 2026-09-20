import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBackendConfigured } from "@/lib/env";
import { LeaguePatch } from "@/components/ui/Marks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recap" };

type Summary = { participant?: string; approved_points?: number; max_points?: number; approved_challenges?: number; total_challenges?: number; run_distance_km?: number | null; prop_winners?: string | null; prediction_winners?: string | null; issued_at?: string; event_name?: string; league_name?: string };

/** Public recap: only rendered when the commissioner published AND the participant consented. No media. */
export default async function PublicRecapPage(props: PageProps<"/recap/public/[league]/[event]">) {
  const { league, event } = await props.params;
  if (!isBackendConfigured()) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_certificate", { p_league_slug: league, p_event_slug: event });
  const s = (data ?? null) as Summary | null;
  if (!s || !s.participant) notFound();
  return (
    <div className="pb">
      <main className="pb-content" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="pb-certificate">
          <div className="pb-kicker">{s.league_name?.toUpperCase()} · COMMISSIONER CERTIFIED</div>
          <div className="pb-champion-crest">
            <LeaguePatch />
          </div>
          <h2>{s.participant.split(" ")[0]} survived Pofadder.</h2>
          <p>
            {s.event_name}. Two overnight buses. Fourteen kilometres. Ten plays.
            <br />
            One outstanding contribution to league entertainment.
          </p>
          <div className="pb-stat-row">
            <div className="pb-stat">
              <strong>
                {s.approved_points} / {s.max_points}
              </strong>
              <small>APPROVED PROOF</small>
            </div>
            <div className="pb-stat">
              <strong>{s.run_distance_km != null ? `${Number(s.run_distance_km).toFixed(2)} km` : "—"}</strong>
              <small>RUN COMPLETED</small>
            </div>
            <div className="pb-stat">
              <strong>
                {s.approved_challenges} / {s.total_challenges}
              </strong>
              <small>CHALLENGES SERVED</small>
            </div>
          </div>
          <p className="pb-small">
            Prop board: {s.prop_winners || "not settled"} · Predictions: {s.prediction_winners || "no awards"}
          </p>
          <div className="pb-signature">The Commissioner</div>
          <p className="pb-small">Published with the participant’s consent. Unofficial fantasy league; no NFL affiliation.</p>
        </div>
      </main>
    </div>
  );
}
