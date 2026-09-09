import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label: string;
}

export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label
      className={["sot-checkbox", className].filter(Boolean).join(" ")}
      htmlFor={inputId}
    >
      <input id={inputId} type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}
