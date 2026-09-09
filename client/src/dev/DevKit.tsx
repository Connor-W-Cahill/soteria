import { useState } from "react";
import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Select,
  SeverityBadge,
  SparklineCard,
  Tabs,
  useToast,
} from "../components";
import type { Severity } from "../components";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "none"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sot-stack" style={{ marginBottom: "var(--space-6)" }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function DevKit() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const toast = useToast();

  return (
    <div className="sot-stack">
      <h1>Design system kit</h1>
      <p>
        Every base component, rendered from seeded tokens. Toggle the theme in
        band 1.
      </p>

      <Section title="Buttons">
        <div className="sot-row">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Refresh">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3" />
            </svg>
          </IconButton>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="sot-row" style={{ alignItems: "flex-start" }}>
          <Input
            label="Display name"
            placeholder="Ada Lovelace"
            hint="Shown on your dashboard only."
          />
          <Select
            label="Update frequency"
            defaultValue="weekly"
            hint="How often Soteria checks for changes."
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>
        <Checkbox label="Email me when a new CVE affects my software" />
      </Section>

      <Section title="Cards">
        <div className="sot-row" style={{ alignItems: "stretch" }}>
          <Card title="Flat-bordered card">
            <p>Depth comes from the border and surface-alt fills. No shadow.</p>
          </Card>
          <Card title="Alt surface" alt>
            <p>Same border, tinted background.</p>
          </Card>
        </div>
      </Section>

      <Section title="Badges and severity">
        <div className="sot-row">
          <Badge>Beta</Badge>
          <Badge isNew>Changed since last visit</Badge>
          {SEVERITIES.map((s) => (
            <SeverityBadge key={s} severity={s} />
          ))}
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs
          label="Kit example tabs"
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: <p>Overview panel content.</p>,
            },
            {
              id: "details",
              label: "Details",
              content: <p>Details panel content.</p>,
            },
            {
              id: "history",
              label: "History",
              content: <p>History panel content.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Dialog and toast">
        <div className="sot-row">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button
            variant="secondary"
            onClick={() => toast.push("Saved your changes.")}
          >
            Show toast
          </Button>
          <Button
            variant="ghost"
            onClick={() => toast.push("New CVE match found.", { accent: true })}
          >
            Show accent toast
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Delete this recommendation?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Delete</Button>
            </>
          }
        >
          <p>This cannot be undone.</p>
        </Dialog>
      </Section>

      <Section title="Sparkline cards">
        <div className="sot-row" style={{ alignItems: "stretch" }}>
          <SparklineCard
            name="Password hygiene"
            value={72}
            why="Two reused passwords found in your questionnaire."
            history={[40, 45, 52, 60, 58, 72]}
          />
          <SparklineCard
            name="Software exposure"
            value={"B-"}
            why="One app is three major versions behind."
            history={[80, 78, 70, 65, 60, 55]}
          />
        </div>
      </Section>

      <Section title="Empty state">
        <Card>
          <EmptyState
            title="No software tracked yet"
            body="Add the apps and operating systems you use and Soteria will watch for new vulnerabilities."
            action={<Button>Add software</Button>}
          />
        </Card>
      </Section>
    </div>
  );
}

export default DevKit;
