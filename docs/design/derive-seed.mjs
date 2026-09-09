#!/usr/bin/env node
// Deterministically derive Soteria's visual design tokens from a 32-bit seed.
// Usage: node docs/design/derive-seed.mjs [seed]
// The seed for this project is fixed at 3080478562 (see docs/design/DESIGN_SEED.md).
// Anyone re-running this script with that seed gets the identical token set.

const seed = Number(process.argv[2] ?? 3080478562) >>> 0;

// mulberry32 PRNG: small, deterministic, reproducible in any JS runtime.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(seed);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const range = (min, max, step = 1) => min + Math.floor(rand() * ((max - min) / step + 1)) * step;

const primaryHue = range(0, 359);
const accentScheme = pick(["complementary", "split-complementary", "triadic", "analogous"]);
const accentOffset = { complementary: 180, "split-complementary": 150, triadic: 120, analogous: 40 }[accentScheme];
const accentHue = (primaryHue + accentOffset) % 360;
const neutralTemp = pick(["cool", "warm", "neutral"]);
const neutralHue = { cool: (primaryHue + 200) % 360, warm: 40, neutral: primaryHue }[neutralTemp];
const neutralChroma = pick([0.005, 0.012, 0.02]);
const primaryChroma = pick([0.12, 0.16, 0.2]);

const fontPairings = [
  { heading: "Fraunces", body: "Inter", mono: "JetBrains Mono" },
  { heading: "Space Grotesk", body: "IBM Plex Sans", mono: "IBM Plex Mono" },
  { heading: "Playfair Display", body: "Source Sans 3", mono: "Source Code Pro" },
  { heading: "Manrope", body: "Manrope", mono: "Fira Code" },
  { heading: "Bricolage Grotesque", body: "Figtree", mono: "Geist Mono" },
  { heading: "DM Serif Display", body: "DM Sans", mono: "DM Mono" },
  { heading: "Sora", body: "Nunito Sans", mono: "Red Hat Mono" },
  { heading: "Newsreader", body: "Work Sans", mono: "Overpass Mono" },
];
const fonts = pick(fontPairings);
const typeScale = pick([1.2, 1.25, 1.333]);
const baseFontPx = pick([15, 16, 17]);

const radius = pick(["sharp", "soft", "round", "pill"]);
const radiusPx = { sharp: 2, soft: 6, round: 12, pill: 20 }[radius];
const density = pick(["compact", "comfortable", "airy"]);
const spaceUnit = { compact: 4, comfortable: 6, airy: 8 }[density];
const shell = pick(["left-sidebar", "top-nav", "top-nav-with-rail", "split-header"]);
const cardStyle = pick(["flat-bordered", "elevated", "tinted-surface", "outlined-accent"]);
const shadow = pick(["none", "subtle", "layered"]);
const motion = pick(["minimal", "gentle", "expressive"]);
const scoreViz = pick(["radial-gauge", "segmented-bar", "stacked-tiles", "sparkline-cards"]);
const emptyStateStyle = pick(["illustrated-geometric", "typographic", "iconic"]);
const severityPalette = pick(["hue-shifted", "saturation-ramp", "lightness-ramp"]);
const darkModeDefault = pick(["system", "light-first", "dark-first"]);

const tokens = {
  seed,
  color: {
    primaryHue, primaryChroma, accentScheme, accentHue, neutralTemp, neutralHue, neutralChroma,
    // OKLCH so hue stays perceptually stable across the ramp.
    primary: `oklch(0.55 ${primaryChroma} ${primaryHue})`,
    primaryStrong: `oklch(0.42 ${primaryChroma} ${primaryHue})`,
    primarySoft: `oklch(0.93 ${(primaryChroma / 3).toFixed(3)} ${primaryHue})`,
    accent: `oklch(0.7 0.15 ${accentHue})`,
    surface: `oklch(0.985 ${neutralChroma} ${neutralHue})`,
    surfaceAlt: `oklch(0.955 ${neutralChroma} ${neutralHue})`,
    text: `oklch(0.22 ${neutralChroma} ${neutralHue})`,
    textMuted: `oklch(0.48 ${neutralChroma} ${neutralHue})`,
    border: `oklch(0.88 ${neutralChroma} ${neutralHue})`,
    // Severity colors are fixed for legibility; the ramp style is seeded.
    severityStyle: severityPalette,
    severity: { critical: "oklch(0.5 0.2 25)", high: "oklch(0.62 0.18 45)", medium: "oklch(0.75 0.15 80)", low: "oklch(0.6 0.12 200)", none: "oklch(0.6 0.12 150)" },
  },
  type: { ...fonts, typeScale, baseFontPx },
  shape: { radius, radiusPx, shadow, cardStyle },
  layout: { density, spaceUnit, shell },
  behavior: { motion, darkModeDefault },
  components: { scoreViz, emptyStateStyle },
};

console.log(JSON.stringify(tokens, null, 2));
