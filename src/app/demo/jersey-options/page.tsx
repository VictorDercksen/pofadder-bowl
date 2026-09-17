import { JerseyCard, type JerseyVariant } from "@/components/ui/JerseyCard";

/** TEMPORARY: renders every jersey layout with the same sample thread for screenshots. Delete before merge. */
const POSTS = [
  { team: "nyg", name: "DERCKSEN", number: 26, heading: "Victor checked in", message: "Pofadder. Still here. Still questioning my draft.\nThe guesthouse owner asked why I came. I did not have a good answer.", time: "10:35", kind: "Check-in", count: 8, reacted: true, captain: true },
  { team: "kc", name: "COMMISH", number: 1, heading: "Points on the board", message: "14 km run approved. That’s 25 points and one very questionable holiday.", time: "09:02", kind: "Commissioner call", count: 3, reacted: false, captain: true },
  { team: "cin", name: "LOTTER", number: 9, heading: "Trade offer incoming", message: "Have you tried trading your return ticket for a running back?", time: "08:54", kind: "League comment", count: 12, reacted: false, captain: false },
];

const OPTIONS: { id: string; variant: JerseyVariant; title: string; blurb: string }[] = [
  { id: "opt-a", variant: "post", title: "Option A · Forum post on the jersey", blurb: "Full jersey frame kept. The torso carries a cream forum post with byline, reading-size message and footer." },
  { id: "opt-b", variant: "yoke", title: "Option B · Jersey header, thread body", blurb: "Compact jersey top (shoulders, collar, number, name). The message hangs below as a paper post with a kit-coloured rail." },
  { id: "opt-c", variant: "avatar", title: "Option C · Jersey as avatar", blurb: "Classic forum row. Small jersey on the left, the message owns the right column." },
  { id: "opt-d", variant: "torso", title: "Option D · Same jersey, message re-weighted", blurb: "Smallest change. Same silhouette and chest number; the message becomes the main block on a darker panel." },
  { id: "opt-0", variant: "classic", title: "Current · for comparison", blurb: "What is live today." },
];

export default function Page() {
  return (
    <>
      {OPTIONS.map((o) => (
        <section key={o.id} id={o.id} className="pb-sideline" style={{ paddingBottom: 30 }}>
          <div className="pb-sideline-head">
            <div>
              <div className="pb-kicker">JERSEY POST LAYOUTS</div>
              <h2>{o.title}</h2>
            </div>
            <p className="pb-small">{o.blurb}</p>
          </div>
          <div className="pb-jersey-feed">
            {POSTS.map((p, i) => (
              <JerseyCard
                key={i}
                variant={o.variant}
                team={p.team}
                displayName={p.name}
                number={p.number}
                heading={p.heading}
                message={p.message}
                timestamp={`${p.time} · ${p.kind}`}
                time={p.time}
                kind={p.kind}
                captain={p.captain}
                reaction={<button className="pb-reaction" type="button" aria-pressed={p.reacted}>😂 {p.count} · No sympathy</button>}
                actions={
                  <>
                    <a className="pb-post-action" href="#sideline-comment">Reply</a>
                    <span className="pb-post-action right">#{i + 1}</span>
                  </>
                }
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
