import { useId } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  /** Required: icon-only controls must expose an accessible name and a visible tooltip. */
  label: string;
  children: ReactNode;
}

export function IconButton({
  label,
  className,
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  const tipId = useId();
  return (
    <span className="sot-tooltip-host">
      <button
        type={type}
        aria-label={label}
        aria-describedby={tipId}
        className={["sot-btn", "sot-btn--secondary", "sot-btn--icon", className]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </button>
      <span id={tipId} role="tooltip" className="sot-tooltip">
        {label}
      </span>
    </span>
  );
}
