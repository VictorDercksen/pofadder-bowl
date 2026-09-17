/**
 * The league's loading mark: a football tumbling end over end. Plain SVG so it renders in
 * Server Components, loading boundaries and Suspense fallbacks alike. Animation lives in
 * globals.css (`pb-football`), and stops under prefers-reduced-motion.
 */
export function Football({ size = 30, spinning = true, className = "" }: { size?: number; spinning?: boolean; className?: string }) {
  return (
    <svg className={`pb-football ${spinning ? "spin" : ""} ${className}`.trim()} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      <g transform="rotate(-38 32 32)">
        <ellipse cx="32" cy="32" rx="29" ry="17" fill="#8a4a22" stroke="#4d2710" strokeWidth="2.2" />
        <path d="M10 32c10-12 34-12 44 0" fill="none" stroke="#a35f2f" strokeWidth="1.5" opacity=".7" />
        <path d="M8.5 27.5c1.8-3 4.2-5.6 7-7.8M8.5 36.5c1.8 3 4.2 5.6 7 7.8M55.5 27.5c-1.8-3-4.2-5.6-7-7.8M55.5 36.5c-1.8 3-4.2 5.6-7 7.8" fill="none" stroke="#f4f0e6" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M21 32h22" fill="none" stroke="#f4f0e6" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M25 28.5v7M29.5 28.5v7M34 28.5v7M38.5 28.5v7" fill="none" stroke="#f4f0e6" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Route-level loading state: the ball spins while the next screen streams in. */
export function LoadingPlay({ label = "Loading the next play…", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`pb-loading ${compact ? "compact" : ""}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <Football size={compact ? 34 : 56} />
      <div>
        <div className="pb-kicker">SNAP COUNT</div>
        <p>{label}</p>
      </div>
      {compact ? null : (
        <div className="pb-loading-skeleton" aria-hidden="true">
          <span style={{ width: "62%" }} />
          <span style={{ width: "88%" }} />
          <span style={{ width: "74%" }} />
        </div>
      )}
    </div>
  );
}
