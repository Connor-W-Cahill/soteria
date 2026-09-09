import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
}

/** Geometric inline SVG: circles, lines and rounded rects only. No stock art, no emoji. */
function GeometricArt() {
  return (
    <svg
      width="120"
      height="80"
      viewBox="0 0 120 80"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="8"
        y="14"
        width="104"
        height="52"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="8"
        y1="30"
        x2="112"
        y2="30"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="18" cy="22" r="3" fill="currentColor" />
      <circle cx="30" cy="22" r="3" fill="currentColor" />
      <rect
        x="20"
        y="40"
        width="46"
        height="8"
        rx="4"
        fill="currentColor"
        opacity="0.35"
      />
      <rect
        x="20"
        y="52"
        width="30"
        height="8"
        rx="4"
        fill="currentColor"
        opacity="0.2"
      />
      <circle
        cx="92"
        cy="50"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="92"
        y1="44"
        x2="92"
        y2="56"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="86"
        y1="50"
        x2="98"
        y2="50"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="sot-empty">
      <span className="sot-empty__art" aria-hidden="true">
        <GeometricArt />
      </span>
      <h3 className="sot-empty__title">{title}</h3>
      <p className="sot-empty__body">{body}</p>
      {action}
    </div>
  );
}
