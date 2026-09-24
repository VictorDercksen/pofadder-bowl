"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { composeRating, formatRating, RATING_MAX, splitRating } from "@/lib/rating";

export { RATING_MAX };
const CELLS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);
const TENTHS = Array.from({ length: 10 }, (_, i) => i);

type Props = {
  /** Current score (1.0 to 10.0, one decimal), or null for "not rated yet". */
  value: number | null;
  /** Accessible name for the group, e.g. "Chicken and rib combo rating". */
  label: string;
  onChange?: (value: number) => void;
  /** Renders the strip as a display only (no buttons, no focus). */
  readOnly?: boolean;
  disabled?: boolean;
  /** `dark` sits on the green clip panel; `light` on paper. */
  tone?: "light" | "dark";
  /** `small` is the compact strip for lists and results. */
  size?: "regular" | "small";
  /** Text under the number, e.g. "VICTOR'S VERDICT". */
  caption?: string;
};

/**
 * The out-of-ten rating strip: ten cells, the whole number in orange, everything below it in
 * the green, and the decimal as a partial fill of the next cell. When setting a score a second
 * row picks the decimal (.0 to .9). One component for setting the score (participant,
 * prediction slip, commissioner) and for showing it (league view, results), so the score looks
 * the same everywhere.
 */
export function RatingSelector({ value, label, onChange, readOnly = false, disabled = false, tone = "light", size = "regular", caption }: Props) {
  const interactive = !readOnly && !disabled && Boolean(onChange);
  const classes = ["pb-rating", tone === "dark" ? "dark" : "", size === "small" ? "small" : "", readOnly ? "readonly" : ""].filter(Boolean).join(" ");
  const { whole, tenth } = value == null ? { whole: 0, tenth: 0 } : splitRating(value);

  function cellProps(n: number): { className: string; style?: CSSProperties } {
    let className = "pb-rating-cell";
    if (n < whole) className += " on";
    if (n === whole) className += " pick";
    if (tenth > 0 && n === whole + 1) return { className: `${className} part`, style: { "--part": `${tenth * 10}%` } as CSSProperties };
    return { className };
  }

  function move(e: KeyboardEvent<HTMLButtonElement>, current: number, min: number, max: number): number | null {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") return Math.min(max, current + 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") return Math.max(min, current - 1);
    if (e.key === "Home") return min;
    if (e.key === "End") return max;
    return null;
  }

  function onWholeKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (!interactive || !onChange) return;
    const next = move(e, whole, 1, RATING_MAX);
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`button[data-value="${next}"]`)?.focus();
  }

  function onTenthKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (!interactive || !onChange || value == null) return;
    const next = move(e, tenth, 0, 9);
    if (next == null) return;
    e.preventDefault();
    onChange(composeRating(whole, next));
    e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`button[data-tenth="${next}"]`)?.focus();
  }

  const shown = value == null ? null : formatRating(value);
  const score = (
    <div className="pb-rating-score" aria-hidden={readOnly ? undefined : true}>
      <b>{shown ?? "–"}</b>
      <small>/ {RATING_MAX}</small>
      {caption ? <span>{caption}</span> : null}
    </div>
  );

  if (readOnly) {
    return (
      <div className={classes} role="img" aria-label={shown == null ? `${label}: not rated yet` : `${label}: ${shown} out of ${RATING_MAX}`}>
        <div className="pb-rating-cells">
          {CELLS.map((n) => (
            <span key={n} {...cellProps(n)}>
              {n}
            </span>
          ))}
        </div>
        {score}
      </div>
    );
  }

  const tenthsOff = disabled || value == null || whole >= RATING_MAX;
  return (
    <div className={classes}>
      <div className="pb-rating-body">
        <div className="pb-rating-cells" role="radiogroup" aria-label={label}>
          {CELLS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              data-value={n}
              aria-checked={whole === n}
              aria-label={`${n} out of ${RATING_MAX}`}
              tabIndex={n === (whole || 1) ? 0 : -1}
              disabled={disabled}
              {...cellProps(n)}
              onClick={() => onChange?.(n)}
              onKeyDown={onWholeKey}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="pb-rating-tenths" role="radiogroup" aria-label={`${label}, decimal`}>
          {TENTHS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              data-tenth={d}
              aria-checked={value != null && tenth === d}
              aria-label={value == null ? `Point ${d}` : `${whole}.${d} out of ${RATING_MAX}`}
              tabIndex={d === tenth ? 0 : -1}
              disabled={tenthsOff}
              className={`pb-rating-tenth${value != null && tenth === d ? " pick" : ""}`}
              onClick={() => onChange?.(composeRating(whole, d))}
              onKeyDown={onTenthKey}
            >
              .{d}
            </button>
          ))}
        </div>
      </div>
      {score}
    </div>
  );
}

/** Inline "7.5 / 10" pill for tables and list rows; "Unrated" when there is no score yet. */
export function RatingBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={`pb-rating-badge muted${className ? ` ${className}` : ""}`}>Unrated</span>;
  return (
    <span className={`pb-rating-badge${className ? ` ${className}` : ""}`}>
      {formatRating(value)}
      <small>/ {RATING_MAX}</small>
    </span>
  );
}
