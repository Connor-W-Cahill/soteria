import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  /** Marks "new" / "changed since last visit" — adds the accent dot. */
  isNew?: boolean;
}

export function Badge({ children, isNew = false }: BadgeProps) {
  return (
    <span
      className={["sot-badge", isNew ? "sot-badge--new" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {isNew ? <span className="sot-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
