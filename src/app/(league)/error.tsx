"use client";

export default function LeagueError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="pb"><section className="pb-panel pb-recovery" role="alert">
      <div className="pb-kicker">DATA UNAVAILABLE</div>
      <h1>The league could not be loaded.</h1>
      <p>Your proof and scores have not been cleared. Check your connection and try again.</p>
      <button className="pb-primary" type="button" onClick={retry}>Try again</button>
    </section></div>
  );
}
