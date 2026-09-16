import { LeaguePatch, Shield, TeamLogo } from "@/components/ui/Marks";
import { TitleRow } from "@/components/ui/TitleRow";
import { PressRoom } from "@/components/press/PressRoom";
import { getLeagueContext } from "@/lib/league";
import { loadSubmissions } from "@/lib/evidence";
import { formatDateTime, formatTime, nowMs } from "@/lib/time";
import { kitVars } from "@/lib/nfl";
import type { CSSProperties } from "react";

export const metadata = { title: "Press room" };

export default async function PressPage() {
  const ctx = await getLeagueContext();
  const tz = ctx.event.timezone;
  const now = nowMs();
  const [{ data: prompts }, subs, { data: participant }] = await Promise.all([
    ctx.supabase.from("press_prompts").select("*").eq("event_id", ctx.event.id).order("slot").order("sequence"),
    loadSubmissions(ctx),
    ctx.event.participant_user_id ? ctx.supabase.from("profiles").select("display_name, kit_team, kit_number").eq("id", ctx.event.participant_user_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const list = (prompts ?? []).map((p) => {
    const latest = subs.find((s) => s.press_prompt_id === p.id) ?? null;
    return { ...p, open: now >= Date.parse(p.opens_at) && (!p.closes_at || now < Date.parse(p.closes_at)), latest: latest ? { id: latest.id, version: latest.version, status: latest.status, caption: latest.caption, files: latest.files } : null };
  });
  const midday = list.filter((p) => p.slot === "midday");
  const sunset = list.filter((p) => p.slot === "sunset");

  return (
    <>
      <TitleRow kicker={`${ctx.isParticipant ? "VICTOR’S VIEW" : "LEAGUE VIEW"} · MEDIA DUTY`} title="Face the press." blurb="Questions from a league that has absolutely no intention of helping." tag={midday.some((p) => p.open) ? "PROMPTS OPEN" : "TIME-GATED"} team={participant?.kit_team ?? ctx.profile.kit_team} />
      <div className="pb-split">
        <div>
          <div className="pb-press kit" style={kitVars(participant?.kit_team) as CSSProperties}>
            <div className="pb-press-sponsors" aria-hidden="true">
              <TeamLogo code={participant?.kit_team} decorative size={38} />
              <Shield size={26} height={35} />
              <span className="pb-small" style={{ color: "#e6e0d0", letterSpacing: 1 }}>{participant ? `${participant.display_name.toUpperCase()} · #${String(participant.kit_number).padStart(2, "0")}` : "PARTICIPANT"}</span>
              <TeamLogo code={participant?.kit_team} decorative size={160} className="pb-kit-watermark" />
            </div>
            <small>POFADDER BOWL · PRESS CONFERENCE</small>
            <PressRoom prompts={list.map((p) => ({ id: p.id, slot: p.slot, sequence: p.sequence, question: p.question, opens_at: p.opens_at, open: p.open, latest: p.latest }))} canAnswer={ctx.isParticipant} timezone={tz} />
            <div className="pb-press-mic">
              <LeaguePatch small /> LEAGUE MEDIA DAY
            </div>
          </div>
        </div>
        <div className="pb-panel">
          <h3>The media schedule</h3>
          <div className="pb-challenge">
            <span className="pb-time">Q3</span>
            <div>
              <strong>Midday press conference</strong>
              <p>
                {midday[0] ? `Opens ${formatDateTime(midday[0].opens_at, tz)}` : "Not scheduled"} · {midday.filter((p) => p.latest?.status === "submitted" || p.latest?.status === "approved").length}/{midday.length} answered
              </p>
            </div>
          </div>
          <div className="pb-challenge">
            <span className="pb-time">Q4</span>
            <div>
              <strong>The sunset speech</strong>
              <p>{sunset[0] ? `${formatTime(sunset[0].opens_at, tz)} · One final statement to the league` : "Not scheduled"}</p>
            </div>
          </div>
          <div className="pb-next">
            <h3>No comment is still a comment.</h3>
            <p>Address the league, own the result, and give your next-season promise. Answers go through the same evidence pipeline and commissioner review.</p>
          </div>
        </div>
      </div>
    </>
  );
}
