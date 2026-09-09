export type Severity = "critical" | "high" | "medium" | "low" | "none";

const LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

export interface SeverityBadgeProps {
  severity: Severity;
  /** Override the visible label; the severity is never conveyed by color alone. */
  label?: string;
}

export function SeverityBadge({ severity, label }: SeverityBadgeProps) {
  return (
    <span className={`sot-sev sot-sev--${severity}`}>
      <span className="sot-sev__swatch" aria-hidden="true" />
      {label ?? LABELS[severity]}
    </span>
  );
}
