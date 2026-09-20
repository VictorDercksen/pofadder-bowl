"use client";

import type { KeyboardEvent } from "react";

export const RATING_MAX = 10;
const CELLS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);

type Props = {
  /** Current score, or null for "not rated yet". */
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
 * The out-of-ten rating strip: ten cells, the pick in orange, everything below it in the
 * green. One component for setting the score (participant, prediction slip, commissioner)
 * and for showing it (league view, results), so the score looks the same everywhere.
 */
export function RatingSelector({ value, label, onChange, readOnly = false, disabled = false, tone = "light", size = "regular", caption }: Props) {
  const interactive = !readOnly && !disabled && Boolean(onChange);
  const classes = ["pb-rating", tone === "dark" ? "dark" : "", size === "small" ? "small" : "", readOnly ? "readonly" : ""].filter(Boolean).join(" ");

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!interactive || !onChange) return;
    const current = value ?? 0;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(RATING_MAX, current + 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, current - 1);
    if (e.key === "Home") next = 1;
    if (e.key === "End") next = RATING_MAX;
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    const cell = e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`button[data-value="${next}"]`);
    cell?.focus();
  }

  const score = (
    <div className="pb-rating-score" aria-hidden={readOnly ? undefined : true}>
      <b>{value ?? "–"}</b>
      <small>/ {RATING_MAX}</small>
      {caption ? <span>{caption}</span> : null}
    </div>
  );

  if (readOnly) {
    return (
      <div className={classes} role="img" aria-label={value == null ? `${label}: not rated yet` : `${label}: ${value} out of ${RATING_MAX}`}>
        <div className="pb-rating-cells">
          {CELLS.map((n) => (
            <span key={n} className={`pb-rating-cell${value != null && n < value ? " on" : ""}${value === n ? " pick" : ""}`}>
              {n}
            </span>
          ))}
        </div>
        {score}
      </div>
    );
  }

  const tabStop = value ?? 1;
  return (
    <div className={classes}>
      <div className="pb-rating-cells" role="radiogroup" aria-label={label}>
        {CELLS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            data-value={n}
            aria-checked={value === n}
            aria-label={`${n} out of ${RATING_MAX}`}
            tabIndex={n === tabStop ? 0 : -1}
            disabled={disabled}
            className={`pb-rating-cell${value != null && n < value ? " on" : ""}${value === n ? " pick" : ""}`}
            onClick={() => onChange?.(n)}
            onKeyDown={onKeyDown}
          >
            {n}
          </button>
        ))}
      </div>
      {score}
    </div>
  );
}

/** Inline "8 / 10" pill for tables and list rows; "Unrated" when there is no score yet. */
export function RatingBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={`pb-rating-badge muted${className ? ` ${className}` : ""}`}>Unrated</span>;
  return (
    <span className={`pb-rating-badge${className ? ` ${className}` : ""}`}>
      {value}
      <small>/ {RATING_MAX}</small>
    </span>
  );
}
