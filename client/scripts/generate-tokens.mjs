#!/usr/bin/env node
// Generate client/src/styles/tokens.css from the seeded design script.
//
// This does NOT hand-pick any value. It runs docs/design/derive-seed.mjs with
// the project seed, then mechanically maps the derived tokens to CSS custom
// properties. Dark mode reuses every hue and chroma and only inverts lightness
// via darkL() below. Run: node client/scripts/generate-tokens.mjs
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";

const SEED = 3080478562;
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../");
const seedScript = resolve(repoRoot, "docs/design/derive-seed.mjs");
const outFile = resolve(here, "../src/styles/tokens.css");

const t = JSON.parse(
  execFileSync("node", [seedScript, String(SEED)], { encoding: "utf8" }),
);

// Parse an "oklch(L C H)" string into numbers.
const parseOklch = (s) => {
  const [, l, c, h] = s
    .match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/)
    .map(Number);
  return { l, c, h };
};
const oklch = ({ l, c, h }) => `oklch(${+l.toFixed(3)} ${+c.toFixed(3)} ${h})`;

// Lightness inversion for dark mode: pivot the light lightness around a dark
// baseline. Uniform transform, applied to every neutral/brand token alike.
const darkL = (l) => Math.min(0.98, Math.max(0.02, 0.16 + (1 - l) * 0.82));
const invert = (s) => oklch({ ...parseOklch(s), l: darkL(parseOklch(s).l) });

const c = t.color;
const scale = (n) => +(t.type.baseFontPx * t.type.typeScale ** n).toFixed(1);

const lines = [];
lines.push("/*");
lines.push(" * Soteria design tokens — GENERATED, do not edit by hand.");
lines.push(` * Source: docs/design/derive-seed.mjs ${SEED}`);
lines.push(" * Regenerate: node client/scripts/generate-tokens.mjs");
lines.push(" * This is the ONLY file allowed to contain literal color, font,");
lines.push(" * radius or shadow values. Everything else consumes these vars.");
lines.push(" */");
lines.push(":root {");
lines.push(`  --seed: "${t.seed}";`);
lines.push("");
lines.push("  /* Color — light (seeded) */");
lines.push(`  --color-primary: ${c.primary};`);
lines.push(`  --color-primary-strong: ${c.primaryStrong};`);
lines.push(`  --color-primary-soft: ${c.primarySoft};`);
lines.push(`  --color-accent: ${c.accent};`);
lines.push(`  --color-surface: ${c.surface};`);
lines.push(`  --color-surface-alt: ${c.surfaceAlt};`);
lines.push(`  --color-text: ${c.text};`);
lines.push(`  --color-text-muted: ${c.textMuted};`);
lines.push(`  --color-border: ${c.border};`);
lines.push(`  --color-on-primary: oklch(0.99 0 ${c.neutralHue});`);
lines.push("");
lines.push(
  "  /* Severity — fixed for legibility, always paired with a text label */",
);
for (const [k, v] of Object.entries(c.severity))
  lines.push(`  --color-severity-${k}: ${v};`);
lines.push("");
lines.push("  /* Type (seeded) */");
lines.push(
  `  --font-heading: "${t.type.heading}", ui-sans-serif, system-ui, sans-serif;`,
);
lines.push(
  `  --font-body: "${t.type.body}", ui-sans-serif, system-ui, sans-serif;`,
);
lines.push(
  `  --font-mono: "${t.type.mono}", ui-monospace, "SFMono-Regular", monospace;`,
);
lines.push(`  --font-size-0: ${scale(0)}px;`);
lines.push(`  --font-size-1: ${scale(1)}px;`);
lines.push(`  --font-size-2: ${scale(2)}px;`);
lines.push(`  --font-size-3: ${scale(3)}px;`);
lines.push(`  --font-size-4: ${scale(4)}px;`);
lines.push(`  --font-size-5: ${scale(5)}px;`);
lines.push("  --line-body: 1.5;");
lines.push("  --line-heading: 1.2;");
lines.push("  --weight-body: 400;");
lines.push("  --weight-body-bold: 600;");
lines.push("  --weight-heading: 600;");
lines.push("  --weight-heading-strong: 700;");
lines.push("");
lines.push("  /* Shape (seeded) */");
lines.push(`  --radius: ${t.shape.radiusPx}px;`);
lines.push("  --border-width: 1px;");
lines.push("");
lines.push("  /* Space — 4px unit (seeded density) */");
[4, 8, 12, 16, 24, 32, 48].forEach((v, i) =>
  lines.push(`  --space-${i + 1}: ${v}px;`),
);
lines.push("");
lines.push("  /* Motion (seeded: gentle) */");
lines.push("  --motion-duration: 175ms;");
lines.push("  --motion-ease: ease-out;");
lines.push("");
lines.push("  /* Accessibility overlay — precedence over seeded tokens */");
lines.push("  --focus-ring-width: 2px;");
lines.push("  --focus-ring-offset: 2px;");
lines.push("  --touch-target: 44px;");
lines.push("  --control-height: 36px;");
lines.push("}");
lines.push("");
// DESIGN_SEED.md:48 requires touch targets of at least 44x44 below 768px, and
// :34 "Inputs 36px tall on desktop, 44px on touch". components.css builds inputs,
// buttons and icon buttons on --control-height, so raising it once here gives
// every control the larger target. Doing it through the token is deliberate: the
// alternative is each feature patching its own controls, which is how the gap
// went unnoticed until /password-tools shipped (#82). axe cannot catch this —
// WCAG 2.2 AA Target Size (Minimum) is only 24px.
lines.push("/* Touch — precedence over the desktop control height */");
lines.push("@media (max-width: 767px) {");
lines.push("  :root {");
lines.push("    --control-height: var(--touch-target);");
lines.push("  }");
lines.push("}");
lines.push("");

const darkVars = [
  `  --color-primary: ${invert(c.primary)};`,
  `  --color-primary-strong: ${invert(c.primaryStrong)};`,
  `  --color-primary-soft: ${invert(c.primarySoft)};`,
  `  --color-accent: ${invert(c.accent)};`,
  `  --color-surface: ${invert(c.surface)};`,
  `  --color-surface-alt: ${invert(c.surfaceAlt)};`,
  `  --color-text: ${invert(c.text)};`,
  `  --color-text-muted: ${invert(c.textMuted)};`,
  `  --color-border: ${invert(c.border)};`,
  `  --color-on-primary: oklch(0.15 0.012 ${c.neutralHue});`,
];
lines.push("/* Dark — same hue and chroma, lightness inverted via darkL() */");
lines.push("@media (prefers-color-scheme: dark) {");
lines.push('  :root:not([data-theme="light"]) {');
darkVars.forEach((l) => lines.push("  " + l));
lines.push("  }");
lines.push("}");
lines.push("");
lines.push('[data-theme="dark"] {');
darkVars.forEach((l) => lines.push(l));
lines.push("}");
lines.push("");

writeFileSync(outFile, lines.join("\n") + "\n");
console.log(`wrote ${outFile}`);
