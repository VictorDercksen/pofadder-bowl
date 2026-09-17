"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { JerseyCard } from "@/components/ui/JerseyCard";
import { LeaguePatch, PbShield, Shield, TeamLogo } from "@/components/ui/Marks";
import { TitleRow } from "@/components/ui/TitleRow";
import { OriginStory } from "@/components/trip/OriginStory";
import { completedLines, winningCells } from "@/lib/bingo";
import { DEMO_BINGO_WORDS, DEMO_QUESTIONS, DemoStatus, useDemo } from "./DemoStore";

function DemoMap() {
  return (
    <div className="pb-map">
      <Image src="/maps/pofadder-region-preview.webp" alt="Regional map of the Western and Northern Cape showing Malmesbury and Pofadder" width={510} height={375} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <span className="pb-map-pin" style={{ left: "43.195%", top: "78.027%" }}>
        <b>Malmesbury · start</b>
      </span>
      <span className="pb-map-pin current" style={{ left: "49.152%", top: "16.473%" }}>
        <b>Victor · Pofadder</b>
      </span>
      <span className="pb-map-fallback-label">STATIC PREVIEW · TOWN-CENTRE DEMO PINS</span>
    </div>
  );
}

function MapSource() {
  return (
    <div className="pb-map-source">
      Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · Town-centre demo pins
    </div>
  );
}

function Feed() {
  const { state, dispatch } = useDemo();
  return (
    <div className="pb-jersey-feed">
      <JerseyCard team="nyg" displayName="DERCKSEN" number={26} heading="Victor checked in" message="Pofadder. Still here. Still questioning my draft." time={state.checkin} kind="Check-in" reaction={<button className="pb-reaction" type="button" aria-pressed={state.reaction} onClick={() => dispatch({ type: "react" })}>😂 {state.reaction ? 9 : 8} · No sympathy</button>} actions={<a className="pb-post-action" href="#demo-comment">Reply</a>} />
      <JerseyCard team="kc" displayName="COMMISH" number={1} heading="Points on the board" message="14 km run approved. That’s 25 points and one very questionable holiday." time="09:02" kind="Challenge #02" />
      <JerseyCard team="cin" displayName="THE LEAGUE" number={9} heading="Trade offer incoming" message="Have you tried trading your return ticket for a running back?" time="08:54" kind="League comment" />
      {state.submitted ? <JerseyCard team="nyg" displayName="DERCKSEN" number={26} heading="New proof submitted" message="Three locals. One difficult explanation." time="Just now" kind={state.review} /> : null}
      {state.comments.map((c, i) => (
        <JerseyCard key={i} team="nyg" displayName="DERCKSEN" number={26} heading="From your locker" message={c} time="Just now" kind="Demo comment" />
      ))}
    </div>
  );
}

export function DemoCentre() {
  const { state, dispatch } = useDemo();
  const [comment, setComment] = useState("");
  return (
    <>
      <TitleRow kicker="LEAGUE VIEW · THU 24 SEPT · 10:35 SAST" title="The away game is on." blurb="One man in Pofadder. An entire league enjoying it." tag="Q3 · TOWN DUTY" team="nyg" />
      <div className="pb-broadcast">
        <div>
          <div className="pb-broadcast-head">
            <Shield size={25} height={34} />
            <div className="pb-kicker">POFADDER BOWL · PUNISHMENT SERIES</div>
          </div>
          <h2>POFADDER HAS HOME ADVANTAGE.</h2>
          <p className="pb-small">VICTOR DERCKSEN vs THE CONSEQUENCES</p>
          <div className="pb-quarters">
            <span>Q1 · BUS ✓</span>
            <span>Q2 · RUN ✓</span>
            <span className="active">Q3 · TOWN</span>
            <span>Q4 · HOME</span>
          </div>
        </div>
        <div className="pb-score">
          {state.points}
          <small>OF 100 APPROVED</small>
        </div>
      </div>
      <div className="pb-centre-top">
        <div className="pb-panel pb-plain-map">
          <DemoMap />
          <MapSource />
          <div className="pb-location">
            <div>
              <b>Last check-in · Pofadder</b>
              <span className="pb-small">
                {state.checkin} · {state.sharing ? "Sharing with the league" : "Sharing paused"}
              </span>
            </div>
            <Link className="pb-text-action" href="/demo/map">Open map ↗</Link>
          </div>
        </div>
        <div className="pb-next-drive">
          <div className="pb-panel-top">
            <div className="pb-kicker">NEXT DRIVE · 10 POINTS</div>
            <span className="pb-down-marker" aria-label="Quarter 3">3</span>
          </div>
          <h2>
            Three locals.
            <br />
            Three clips.
          </h2>
          <p className="pb-small">Find out what Pofadder is known for. Prepare to explain fantasy football.</p>
          <div className="pb-drive-stripe" aria-hidden="true" />
          <Link className="pb-primary orange" href="/demo/proof">Open the proof locker ↗</Link>
          <div className="pb-next" style={{ marginTop: "auto" }}>
            <div className="pb-kicker">RETURN BUS · 22:30</div>
            <h3>11 h 55 m to go</h3>
            <p>KLK Garage · Sample countdown</p>
          </div>
        </div>
      </div>
      <section className="pb-sideline">
        <div className="pb-sideline-head">
          <div>
            <div className="pb-kicker">THE LOCKER ROOM IS TALKING</div>
            <h2>League sideline</h2>
          </div>
          <p className="pb-small">
            Team kits. Personal takes.
            <br />
            Illustrative jersey assignments.
          </p>
        </div>
        <Feed />
        <div className="pb-comment-box">
          <label className="pb-field">
            Add to the commentary
            <input id="demo-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Show absolutely no sympathy…" />
          </label>
          <div className="pb-actions">
            <button className="pb-secondary" type="button" onClick={() => { dispatch({ type: "comment", text: comment }); setComment(""); }}>Post comment</button>
          </div>
        </div>
      </section>
      <DemoStatus />
    </>
  );
}

export function DemoTrip() {
  const { state, dispatch } = useDemo();
  return (
    <>
      <TitleRow kicker="VICTOR’S VIEW · MOBILE FIRST" title="Your next play." blurb="Check in. Get the proof. Survive the group chat." tag="PARTICIPANT" team="nyg" />
      <div className="pb-split">
        <div className="pb-phone">
          <div className="pb-phone-top">
            <b>10:35</b>
            <span>●●● ▰</span>
          </div>
          <div className="pb-kicker">THURSDAY · QUARTER THREE</div>
          <div className="pb-logo-stage">
            <TeamLogo code="nyg" size={44} />
            <LeaguePatch />
            <Shield size={35} height={44} />
          </div>
          <h2>
            Morning, Victor.
            <br />
            No appeals today.
          </h2>
          <div className="pb-broadcast">
            <div>
              <div className="pb-kicker">APPROVED</div>
              <h3>
                Sentence
                <br />
                in progress
              </h3>
            </div>
            <div className="pb-score">
              {state.points}
              <small>/ 100 POINTS</small>
            </div>
          </div>
          <div className="pb-kicker">UP NEXT · 10 POINTS</div>
          <h3>Ask three locals.</h3>
          <p className="pb-small" style={{ marginTop: 8 }}>Find out what Pofadder is known for. Bring back three clips.</p>
          <div className="pb-actions">
            <Link className="pb-primary orange" href="/demo/proof">Add challenge proof ↗</Link>
            <button className="pb-secondary" type="button" onClick={() => dispatch({ type: "checkin" })}>Update my location</button>
          </div>
          <p className="pb-small" style={{ marginTop: 12 }}>
            Last shared {state.checkin} · {state.sharing ? "League can view" : "Sharing paused"}
          </p>
          <div className="pb-next">
            <h3>22:30. Don’t miss it.</h3>
            <p>Return bus · KLK Garage</p>
          </div>
          <div className="pb-phone-tabs">
            <Link href="/demo/my-trip">My trip</Link>
            <Link href="/demo/proof">Proof</Link>
            <Link href="/demo/bingo">Bingo</Link>
          </div>
        </div>
        <div>
          <div className="pb-panel">
            <h3>Your game plan</h3>
            {[
              ["06:30", "14 km run", "Completed · 25 points approved"],
              ["08:30", "Breakfast + daylight sign", "Completed · Evidence approved"],
              ["10:30", "Town checkpoints", "In progress · Three local interviews"],
              ["13:00", "Chicken & ribs", "Badgers Grill · Rate it on camera"],
              ["17:30", "Sunset loser’s speech", "Press room prompt unlocks"],
            ].map(([t, h, p]) => (
              <div className="pb-challenge" key={t}>
                <span className="pb-time">{t}</span>
                <div>
                  <strong>{h}</strong>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Connection &amp; sharing</h3>
            <label className="pb-check-row">
              <input type="checkbox" checked={state.sharing} onChange={() => dispatch({ type: "toggleSharing" })} />
              Share my check-ins with the league
            </label>
            <label className="pb-check-row">
              <input type="checkbox" checked={state.online} onChange={() => dispatch({ type: "toggleOnline" })} />
              Mobile data connected
            </label>
            <p className="pb-small" style={{ marginTop: 12 }}>{state.online ? "Ready to submit proof." : "Offline example: keep evidence as a draft until you reconnect."}</p>
          </div>
        </div>
      </div>
      <OriginStory />
      <DemoStatus />
    </>
  );
}

export function DemoMapScreen() {
  const { state, dispatch } = useDemo();
  return (
    <>
      <TitleRow kicker="CHECK-INS · LEAGUE ONLY" title="Where’s Victor?" blurb="A fresh check-in whenever you return. A timestamp everyone can trust." tag="LOCATION PREVIEW" team="buf" />
      <div className="pb-split">
        <div className="pb-panel pb-plain-map">
          <DemoMap />
          <MapSource />
          <div className="pb-location">
            <div>
              <b>Victor · Pofadder</b>
              <span className="pb-small">Last shared {state.checkin} · town-centre demo pin</span>
            </div>
            <span className={`pb-tag ${state.sharing ? "" : "orange"}`}>{state.sharing ? "SHARING ON" : "PAUSED"}</span>
          </div>
        </div>
        <div>
          <div className="pb-panel">
            <h3>Location controls</h3>
            <label className="pb-check-row">
              <input type="checkbox" checked={state.sharing} onChange={() => dispatch({ type: "toggleSharing" })} />
              Share my location with league members
            </label>
            <label className="pb-check-row">
              <input type="checkbox" defaultChecked />
              Update when I reopen Game Centre
            </label>
            <div className="pb-actions">
              <button className="pb-primary" type="button" onClick={() => dispatch({ type: "checkin" })}>Update location</button>
              <button className="pb-secondary" type="button" onClick={() => dispatch({ type: "toggleSharing" })}>{state.sharing ? "Pause sharing" : "Resume sharing"}</button>
            </div>
            <p className="pb-small" style={{ marginTop: 12 }}>Check-ins, not a continuous GPS recording. This preview uses a sample location; no device GPS is requested.</p>
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Check-in history</h3>
            {[
              [state.checkin, "Pofadder", "Latest · Town duty"],
              ["04:45", "Pofadder arrival", "Thursday · Arrival confirmed"],
              ["19:15", "Malmesbury departure", "Wednesday · The sentence begins"],
            ].map(([t, h, p]) => (
              <div className="pb-challenge" key={h}>
                <span className="pb-time">{t}</span>
                <div>
                  <strong>{h}</strong>
                  <p>{p}</p>
                </div>
              </div>
            ))}
            <p className="pb-small">Only the start and latest town are pinned in this preview.</p>
          </div>
        </div>
      </div>
      <DemoStatus />
    </>
  );
}

export function DemoProof() {
  const { state, dispatch } = useDemo();
  return (
    <>
      <TitleRow kicker="VICTOR’S VIEW · CHALLENGE #04" title="The proof locker." blurb="Every play needs evidence. Every point has to be earned." tag="10 POINTS AVAILABLE" team="phi" />
      <div className="pb-split">
        <div className="pb-panel">
          <h2>Three locals. Three clips.</h2>
          <p className="pb-small" style={{ marginTop: 9 }}>Ask what Pofadder is known for. Give each clip a caption.</p>
          <div className="pb-drop">
            <h3>Bring receipts. Literally.</h3>
            <p>Photos, video and watch exports live here.</p>
            <div className="pb-actions" style={{ justifyContent: "center" }}>
              <button className="pb-secondary" type="button" onClick={() => dispatch({ type: "attach" })}>Attach sample clips</button>
            </div>
          </div>
          {state.attached ? (
            <div className="pb-file">
              <span className="pb-avatar">▷</span>
              <div>
                <b>local-interviews.mp4</b>
                <br />
                <span className="pb-small">3 sample interviews · Ready to submit</span>
              </div>
            </div>
          ) : null}
          <label className="pb-field">
            Caption
            <textarea defaultValue="Three locals. Nobody understands why I took the bus." placeholder="What did you find out?" />
          </label>
          <div className="pb-actions">
            <button className="pb-primary" type="button" onClick={() => dispatch({ type: "submit" })}>{state.submitted ? "Resubmit proof" : "Submit for review"}</button>
            <button className="pb-secondary" type="button" onClick={() => dispatch({ type: "draft" })}>Save draft</button>
          </div>
          <p className="pb-small" style={{ marginTop: 12 }}>{state.online ? "Connected · Proof goes to commissioner review." : "Offline · Save a draft and submit after reconnecting."}</p>
        </div>
        <div>
          <div className="pb-panel">
            <h3>Your submissions</h3>
            {[
              ["01", "Night welcome sign", "Approved · +5 points"],
              ["02", "14 km run", "Approved · +25 points"],
              ["03", "Daylight welcome sign", "Approved · +5 points"],
              ["04", "Local interviews", state.submitted ? state.review : "Draft · No proof submitted"],
            ].map(([n, h, p]) => (
              <div className="pb-challenge" key={n}>
                <span className="pb-num">{n}</span>
                <div>
                  <strong>{h}</strong>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pb-next">
            <h3>The commissioner has the whistle.</h3>
            <p>Submitted points only count after approval.</p>
          </div>
        </div>
      </div>
      <DemoStatus />
    </>
  );
}

export function DemoReview() {
  const { state, dispatch } = useDemo();
  const [transcript, setTranscript] = useState(false);
  const [note, setNote] = useState("");
  return (
    <>
      <TitleRow kicker="COMMISSIONER’S VIEW" title="Under review." blurb="Watch the evidence. Make the call. Put the points on the board." tag="REVIEW ACCESS" identity={<span className="pb-official-patch">LEAGUE<br />OFFICIAL</span>} />
      <div className="pb-split">
        <div>
          <div className="pb-clip">
            <small>PROOF #04 · SAMPLE MEDIA CARD</small>
            <h2>
              “It’s a fantasy
              <br />
              football thing.”
            </h2>
            <button type="button" className="pb-play" onClick={() => setTranscript(!transcript)}>▷ Preview transcript · 00:42</button>
          </div>
          {transcript ? (
            <div className="pb-review-notes">
              <b>Sample transcript</b>
              <p style={{ marginTop: 8 }}>
                Victor: “What is Pofadder known for?”
                <br />
                Local: “People stopping to ask where they are.”
              </p>
              <p className="pb-small" style={{ marginTop: 7 }}>Illustrative dialogue, not a recording from the trip.</p>
            </div>
          ) : null}
          <div className="pb-panel" style={{ marginTop: 15 }}>
            <div className="pb-panel-top">
              <h3>Local interviews</h3>
              <span className="pb-tag orange">{state.review}</span>
            </div>
            <p className="pb-small">
              Victor Dercksen · Challenge #04 · 10 points
              <br />
              Sample submission · 3 interview clips included
            </p>
            <label className="pb-field">
              Review note
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain your call, especially if you flag the proof." />
            </label>
            <div className="pb-actions">
              <button className="pb-primary" type="button" onClick={() => dispatch({ type: "approve" })}>Approve · +10 points</button>
              <button className="pb-secondary" type="button" onClick={() => dispatch({ type: "flag", note })}>Flag the proof</button>
            </div>
          </div>
        </div>
        <div className="pb-panel">
          <div className="pb-official-strip" aria-hidden="true" />
          <div className="pb-panel-top">
            <h3>Replay checklist</h3>
            <Shield />
          </div>
          {["Three separate interviews", "Question about Pofadder is audible", "Evidence matches the challenge"].map((t) => (
            <label className="pb-check-row" key={t}>
              <input type="checkbox" defaultChecked />
              {t}
            </label>
          ))}
          <div className="pb-stat-row">
            <div className="pb-stat">
              <strong>{state.points}</strong>
              <small>APPROVED POINTS</small>
            </div>
            <div className="pb-stat">
              <strong>{state.review === "Pending review" ? 1 : 0}</strong>
              <small>AWAITING REVIEW</small>
            </div>
          </div>
          <h3>Latest decisions</h3>
          <div className="pb-challenge">
            <span className="pb-num">✓</span>
            <div>
              <strong>14 km run approved</strong>
              <p>Full distance evidenced · +25 points</p>
            </div>
          </div>
          <div className="pb-challenge">
            <span className="pb-num">✓</span>
            <div>
              <strong>Daylight sign approved</strong>
              <p>Running kit visible · +5 points</p>
            </div>
          </div>
        </div>
      </div>
      <DemoStatus />
    </>
  );
}

export function DemoBingo() {
  const { state, dispatch } = useDemo();
  const lines = completedLines(state.bingo);
  const winning = winningCells(state.bingo);
  return (
    <>
      <TitleRow kicker="LEAGUE SIDE QUEST" title="Misery loves company." blurb="Your card. His misfortune. Five in a row wins." tag="PERSONAL BINGO CARD" team="cin" />
      <div className="pb-split">
        <div className="pb-panel">
          <div className="pb-panel-top">
            <h3>Victor’s card</h3>
            <span className="pb-tag">{lines.length ? `BINGO · ${lines.filter((l) => l !== "full_house").length} LINE${lines.length === 1 ? "" : "S"}` : `${state.bingo.size}/25 marked`}</span>
          </div>
          <div className="pb-bingo-banner">
            <TeamLogo code="nyg" size={31} />
            <span>THE PUNISHMENT PLAYBOOK</span>
            <TeamLogo code="cin" size={31} />
          </div>
          <div className="pb-bingo-letters" aria-hidden="true">
            <span>B</span>
            <span>I</span>
            <span>N</span>
            <span>G</span>
            <span>O</span>
          </div>
          <div className="pb-bingo">
            {state.layout.map((pos, cell) => (
              <button key={cell} type="button" aria-pressed={state.bingo.has(cell)} className={`${pos === 12 ? "free" : ""} ${winning.has(cell) ? "winning" : ""}`.trim()} disabled={pos === 12} onClick={() => dispatch({ type: "bingo", cell })}>
                {pos === 12 ? `FREE · ${DEMO_BINGO_WORDS[12]}` : DEMO_BINGO_WORDS[pos]}
              </button>
            ))}
          </div>
          <p className="pb-small" style={{ marginTop: 12 }}>Demo: tap any square. In the league game, confirmed incidents mark everyone’s matching squares and wins are detected on the server.</p>
        </div>
        <div>
          <div className="pb-panel">
            <h3>The misery leaderboard</h3>
            <div className="pb-rank">
              <b className="pb-ranking-num">1</b>
              <TeamLogo code="cin" decorative size={30} />
              <div>
                Tee’z Nuts
                <br />
                <small className="pb-small">First bingo · 10:21</small>
              </div>
              <span>1 line</span>
            </div>
            <div className="pb-rank">
              <b className="pb-ranking-num">2</b>
              <TeamLogo code="det" decorative size={30} />
              <div>
                LaPorta Potty
                <br />
                <small className="pb-small">One square away</small>
              </div>
              <span>9/25</span>
            </div>
            <div className="pb-rank">
              <b className="pb-ranking-num">3</b>
              <TeamLogo code="nyg" decorative size={30} />
              <div>
                Your card
                <br />
                <small className="pb-small">Dignity prepaid</small>
              </div>
              <span>{state.bingo.size}/25</span>
            </div>
          </div>
          <div className="pb-next">
            <h3>Incident booth</h3>
            <p>“Group chat shows zero sympathy.”</p>
            <div className="pb-actions">
              <button className="pb-secondary" type="button" onClick={() => dispatch({ type: "incident" })}>Confirm incident</button>
            </div>
          </div>
        </div>
      </div>
      <DemoStatus />
    </>
  );
}

export function DemoPredictions() {
  const { state, dispatch } = useDemo();
  const [h, setH] = useState(1);
  const [m, setM] = useState(35);
  const [rating, setRating] = useState("8 / 10");
  const [complaints, setComplaints] = useState(12);
  function predict() {
    if (!Number.isInteger(h) || h < 0 || h > 8 || !Number.isInteger(m) || m < 0 || m > 59 || !Number.isInteger(complaints) || complaints < 0 || complaints > 999) {
      dispatch({ type: "notify", text: "Use whole hours (0–8), minutes (0–59), and complaints (0–999)." });
      return;
    }
    dispatch({ type: "predict", h, m, rating, complaints });
  }
  return (
    <>
      <TitleRow kicker="PREGAME VIEW · WED 23 SEPT · 18:00" title="Call it before kickoff." blurb="Predictions lock at departure. Bragging rights are the only currency." tag="LOCKS AT 19:15" team="gb" />
      <div className="pb-split">
        <div className="pb-panel">
          <h2>The prediction slip</h2>
          <label className="pb-field">
            Victor’s 14 km finish time
            <div className="pb-inline-fields">
              <input type="number" min={0} max={8} value={h} onChange={(e) => setH(Number(e.target.value))} aria-label="Run hours" />
              <input type="number" min={0} max={59} value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="Run minutes" />
            </div>
          </label>
          <p className="pb-small" style={{ marginTop: 5 }}>Hours / minutes</p>
          <label className="pb-field">
            Chicken &amp; rib combo rating
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              {["6 / 10", "7 / 10", "8 / 10", "9 / 10", "10 / 10"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="pb-field">
            Recorded complaints
            <input type="number" min={0} max={999} value={complaints} onChange={(e) => setComplaints(Number(e.target.value))} />
          </label>
          <div className="pb-actions">
            <button className="pb-primary" type="button" onClick={predict}>{state.prediction ? "Update predictions" : "Lock in my predictions"}</button>
          </div>
          <p className="pb-small" style={{ marginTop: 12 }}>You can edit until departure. No cash stakes.</p>
        </div>
        <div className="pb-panel">
          <h3>How the points work</h3>
          {[
            ["10", "Closest run time", "Measured against the approved watch export."],
            ["5", "Exact meal rating", "Victor’s on-camera verdict is final."],
            ["5", "Closest complaint count", "Commissioner counts distinct recorded complaints."],
          ].map(([n, h2, p]) => (
            <div className="pb-challenge" key={h2}>
              <span className="pb-num">{n}</span>
              <div>
                <strong>{h2}</strong>
                <p>{p}</p>
              </div>
            </div>
          ))}
          <div className="pb-next">
            <h3>Equal guesses share the glory.</h3>
            <p>Tied winners receive the same points. Results appear at the final whistle.</p>
          </div>
        </div>
      </div>
      <DemoStatus />
    </>
  );
}

export function DemoPress() {
  const { state, dispatch } = useDemo();
  return (
    <>
      <TitleRow kicker="VICTOR’S VIEW · Q3 MEDIA DUTY" title="Face the press." blurb="Questions from a league that has absolutely no intention of helping." tag="SAMPLE PROMPTS" team="kc" />
      <div className="pb-split">
        <div>
          <div className="pb-press">
            <div className="pb-press-sponsors" aria-hidden="true">
              <TeamLogo code="nyg" decorative size={38} />
              <TeamLogo code="kc" decorative size={38} />
              <Shield size={26} height={35} />
              <TeamLogo code="phi" decorative size={38} />
              <TeamLogo code="gb" decorative size={38} />
            </div>
            <small>POFADDER BOWL · PRESS CONFERENCE</small>
            <blockquote>“{DEMO_QUESTIONS[state.question]}”</blockquote>
            <small>
              QUESTION {state.question + 1} OF {DEMO_QUESTIONS.length} · FROM THE LEAGUE
            </small>
            <div className="pb-press-mic">
              <LeaguePatch small /> LEAGUE MEDIA DAY
            </div>
          </div>
          <div className="pb-actions">
            <button className="pb-secondary" type="button" onClick={() => dispatch({ type: "question" })}>Next question</button>
            <button className="pb-primary" type="button" onClick={() => dispatch({ type: "record" })}>Record sample answer</button>
          </div>
          {state.recorded ? (
            <>
              <div className="pb-file">
                <b>Answer recorded · demo clip</b>
                <span className="pb-small">00:27 · Ready for review</span>
              </div>
              <div className="pb-actions">
                <button className="pb-primary" type="button" onClick={() => dispatch({ type: "answer" })}>Submit answer</button>
              </div>
            </>
          ) : null}
        </div>
        <div className="pb-panel">
          <h3>The media schedule</h3>
          <div className="pb-challenge">
            <span className="pb-time">Q3</span>
            <div>
              <strong>Midday press conference</strong>
              <p>Available now · Explain the season</p>
            </div>
          </div>
          <div className="pb-challenge">
            <span className="pb-time">Q4</span>
            <div>
              <strong>The sunset speech</strong>
              <p>17:30 · One final statement to the league</p>
            </div>
          </div>
          <div className="pb-next">
            <h3>No comment is still a comment.</h3>
            <p>Address the league, own the result, and give your next-season promise.</p>
          </div>
        </div>
      </div>
      <DemoStatus />
    </>
  );
}

export function DemoRecap() {
  const { dispatch } = useDemo();
  return (
    <>
      <TitleRow kicker="POSTGAME VIEW · FRI 25 SEPT · 07:35" title="Sentence served." blurb="The bus made it home. The group chat will never let this go." tag="SAMPLE FINAL RESULT" team="sf" />
      <div className="pb-certificate">
        <div className="pb-kicker">SHOW US YOUR TD’S · COMMISSIONER CERTIFIED (SAMPLE)</div>
        <div className="pb-champion-crest">
          <TeamLogo code="nyg" decorative size={55} />
          <Shield size={41} height={53} />
          <LeaguePatch />
        </div>
        <h2>Victor survived Pofadder.</h2>
        <p>
          Two overnight buses. Fourteen kilometres. Ten plays.
          <br />
          One outstanding contribution to league entertainment.
        </p>
        <div className="pb-stat-row">
          <div className="pb-stat">
            <strong>100 / 100</strong>
            <small>APPROVED PROOF</small>
          </div>
          <div className="pb-stat">
            <strong>14.03 km</strong>
            <small>RUN COMPLETED</small>
          </div>
          <div className="pb-stat">
            <strong>10 / 10</strong>
            <small>CHALLENGES SERVED</small>
          </div>
        </div>
        <div className="pb-signature">The Commissioner</div>
        <p className="pb-small">Illustrative completed certificate · 25 September 2026</p>
        <div className="pb-ticket-stub">
          <span>PB26 · SENTENCE CLOSED</span>
          <span className="pb-bars" aria-hidden="true" />
        </div>
      </div>
      <div className="pb-photo-slots">
        <div>
          THE ARRIVAL<small>Welcome-sign photo</small>
        </div>
        <div>
          THE RUN<small>Watch export · 14.03 km</small>
        </div>
        <div>
          THE RETURN<small>22:30 boarding clip</small>
        </div>
      </div>
      <div className="pb-split">
        <div className="pb-panel">
          <h3>League honours</h3>
          <div className="pb-rank">
            <span className="pb-ranking-num">★</span>
            <div>
              Bingo winner
              <br />
              <b>Tee’z Nuts</b>
            </div>
          </div>
          <div className="pb-rank">
            <span className="pb-ranking-num">★</span>
            <div>
              Prediction winner
              <br />
              <b>LaPorta Potty</b>
            </div>
          </div>
          <p className="pb-small" style={{ marginTop: 10 }}>Sample winners for the postgame screen.</p>
        </div>
        <div className="pb-panel">
          <h3>The highlight reel</h3>
          <p className="pb-small" style={{ marginTop: 10 }}>Your best clips, approved proof and check-in history, collected in one permanent league memory.</p>
          <div className="pb-actions">
            <button className="pb-primary" type="button" onClick={() => dispatch({ type: "notify", text: "“Pofadder Bowl 2026: 100 points, 14.03 km, and zero sympathy. Sentence served.” · Sample recap caption" })}>Preview recap caption</button>
            <button className="pb-secondary" type="button" onClick={() => dispatch({ type: "notify", text: "Certificate share preview: Victor Dercksen · Sentence served · 25 September 2026 · Private league audience." })}>Preview certificate share</button>
          </div>
        </div>
      </div>
      <DemoStatus />
    </>
  );
}

export function DemoAccess() {
  const { dispatch } = useDemo();
  const [view, setView] = useState("/demo/my-trip");
  return (
    <>
      <TitleRow kicker="PRIVATE LEAGUE ACCESS" title="Welcome to the consequences." blurb="One league. Three roles. Everyone gets the right view." team="dal" />
      <div className="pb-login pb-panel">
        <div className="pb-brand">
          <PbShield />
          POFADDER BOWL ’26
        </div>
        <h2>Your seat on the sideline.</h2>
        <div className="pb-login-logo-wall" aria-hidden="true">
          {["nyg", "kc", "cin", "phi", "det"].map((c) => (
            <TeamLogo key={c} code={c} decorative size={35} />
          ))}
        </div>
        <label className="pb-field">
          Demo view
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="/demo/my-trip">Victor · Participant</option>
            <option value="/demo/game-centre">League member · Spectator</option>
            <option value="/demo/review">Commissioner · Reviewer</option>
          </select>
        </label>
        <div className="pb-actions">
          <Link className="pb-primary" href={view} onClick={() => dispatch({ type: "notify", text: "Entered the selected demo view. No authentication took place." })}>Enter demo as selected member</Link>
        </div>
        <p className="pb-small" style={{ marginTop: 14 }}>
          This selector only switches demo screens. Real roles are stored server-side and enforced by the database: <Link href="/login">sign in with your league invitation</Link>.
        </p>
      </div>
      <DemoStatus />
    </>
  );
}
