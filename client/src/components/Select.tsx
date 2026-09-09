import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
}

export function Select({
  label,
  hint,
  id,
  className,
  children,
  ...rest
}: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  const hintId = hint ? `${selectId}-hint` : undefined;
  return (
    <div className="sot-field">
      <label className="sot-field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={["sot-select", className].filter(Boolean).join(" ")}
        aria-describedby={hintId}
        {...rest}
      >
        {children}
      </select>
      {hint ? (
        <span className="sot-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
