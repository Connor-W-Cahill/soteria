import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Input({ label, hint, id, className, ...rest }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="sot-field">
      <label className="sot-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={["sot-input", className].filter(Boolean).join(" ")}
        aria-describedby={hintId}
        {...rest}
      />
      {hint ? (
        <span className="sot-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
