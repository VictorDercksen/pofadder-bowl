import { ROSTER, STANDINGS, EVENT_META } from "@/lib/programme";

/** Supplied 2024 standings and final-game roster, shown as supplied (no new statistics). */
export function OriginStory() {
  return (
    <section style={{ marginTop: 27 }} aria-labelledby="origin-heading">
      <div className="pb-kicker">THE ORIGIN STORY · AS SUPPLIED</div>
      <h2 id="origin-heading">How we got here: {EVENT_META.seasonPunished} standings</h2>
      <p className="pb-small" style={{ margin: "8px 0 12px" }}>
        Final regular-season table, {EVENT_META.league}, {EVENT_META.seasonPunished}. Twelve teams, three divisions. The sentenced team is highlighted. Copied from the supplied programme; not recomputed.
      </p>
      <div className="pb-split">
        {STANDINGS.map((div) => (
          <div className="pb-panel" key={div.division}>
            <h3>{div.division} division</h3>
            <table className="pb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>W-L</th>
                  <th className="num">PF</th>
                  <th className="num">PA</th>
                  <th className="num">Rank</th>
                </tr>
              </thead>
              <tbody>
                {div.teams.map((t) => (
                  <tr key={t.team} className={t.sentenced ? "sentenced" : undefined}>
                    <td>{t.divisionPosition}</td>
                    <td>
                      {t.team}
                      <br />
                      <span className="pb-small">{t.manager}</span>
                    </td>
                    <td>{t.record}</td>
                    <td className="num">{t.pointsFor.toFixed(2)}</td>
                    <td className="num">{t.pointsAgainst.toFixed(2)}</td>
                    <td className="num">#{t.overallRank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <div className="pb-panel" style={{ marginTop: 18 }}>
        <div className="pb-panel-top">
          <h3>The final game</h3>
          <span className="pb-tag orange">SUPPLIED · UNVERIFIED</span>
        </div>
        <p className="pb-small">Chase-ing Mahomelessness, full lineup for the game that sent Victor to Pofadder. Actual points, projection underneath. {ROSTER.note}</p>
        <table className="pb-table">
          <thead>
            <tr>
              {ROSTER.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROSTER.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={j === 3 ? "num" : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
