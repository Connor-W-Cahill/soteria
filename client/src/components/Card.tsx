import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title?: ReactNode;
  alt?: boolean;
  children: ReactNode;
}

export function Card({
  title,
  alt = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={["sot-card", alt ? "sot-card--alt" : "", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {title ? <div className="sot-card__title">{title}</div> : null}
      {children}
    </div>
  );
}
