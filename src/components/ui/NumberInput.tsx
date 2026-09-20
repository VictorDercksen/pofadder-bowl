"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** The parsed value; null (or NaN) shows an empty box. */
  value: number | null;
  /** Fires with null while the box is empty, otherwise the parsed number. */
  onChange: (value: number | null) => void;
};

const text = (n: number | null) => (n == null || Number.isNaN(n) ? "" : String(n));

/**
 * A controlled number field that keeps what was typed. Parsing the box on every keystroke and
 * writing the number back turns a cleared field into "0" and the next digit into "058"; this
 * keeps the string in local state and only adopts a value that arrives from outside.
 */
export function NumberInput({ value, onChange, inputMode, ...rest }: Props) {
  const [draft, setDraft] = useState(() => text(value));
  const [adopted, setAdopted] = useState(value);
  // Adopt a new value from props (a reset, a loaded row) unless it is what the draft already says.
  if (value !== adopted && !(Number.isNaN(value as number) && Number.isNaN(adopted as number))) {
    setAdopted(value);
    const parsed = draft.trim() === "" ? null : Number(draft);
    if (parsed !== value && !(Number.isNaN(parsed as number) && Number.isNaN(value as number))) setDraft(text(value));
  }
  return (
    <input
      {...rest}
      type="number"
      inputMode={inputMode ?? (rest.step && String(rest.step) !== "1" ? "decimal" : "numeric")}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        onChange(raw.trim() === "" ? null : Number(raw));
      }}
    />
  );
}
