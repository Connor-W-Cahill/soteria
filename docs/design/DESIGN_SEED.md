# Soteria Design Seed

**Seed: `3080478562`** (32-bit, drawn from `/dev/urandom` on 2026-09-08).

Every visual decision below was derived mechanically from this seed by
`docs/design/derive-seed.mjs`. The point of the seed is that Soteria's look is
*not* an agent's default taste. Agents implementing UI must follow these tokens
and must not substitute their own palette, fonts, radius, or layout. To verify a
token, run:

```sh
node docs/design/derive-seed.mjs 3080478562
```

If the team ever wants a different look, change the seed once, re-run the
script, update this file, and open a `type:chore` issue titled "Reseed design".
Never hand-tune individual tokens; that defeats the seed.

## Derived tokens

| Group | Token | Value | Meaning |
|---|---|---|---|
| Color | primary hue | 177 (OKLCH) | Teal / sea-green. `oklch(0.55 0.12 177)` default, `oklch(0.42 0.12 177)` strong, `oklch(0.93 0.040 177)` soft tint. |
| Color | accent scheme | split-complementary, hue 327 | Orchid / magenta `oklch(0.7 0.15 327)`. Use sparingly: new-alert badges, "changed since last visit" markers, link hover, sparkline highlight point. Not for large fills. |
| Color | neutral temperature | warm, hue 40, chroma 0.012 | Paper-like off-white surfaces `oklch(0.985 0.012 40)`, alt surface `oklch(0.955 0.012 40)`, text `oklch(0.22 0.012 40)`, muted text `oklch(0.48 0.012 40)`, border `oklch(0.88 0.012 40)`. |
| Color | severity ramp | hue-shifted (fixed colors) | critical `oklch(0.5 0.2 25)`, high `oklch(0.62 0.18 45)`, medium `oklch(0.75 0.15 80)`, low `oklch(0.6 0.12 200)`, none `oklch(0.6 0.12 150)`. Severity is never color-only; always pair with a text label. |
| Type | heading font | Sora | Google Fonts. Weights 600/700. |
| Type | body font | Nunito Sans | Google Fonts. Weights 400/600. |
| Type | mono font | Red Hat Mono | For CVE IDs, version strings, hash prefixes, code. |
| Type | scale | 1.2 (minor third), base 15px | 15 / 18 / 21.6 / 25.9 / 31.1 / 37.3 px. Line-height 1.5 body, 1.2 headings. |
| Shape | radius | soft, 6px | One radius everywhere (inputs, buttons, cards, badges use 6px; pills are not used). |
| Shape | shadow | none | No box-shadows. Depth comes from borders and surface-alt fills only. |
| Shape | card style | flat-bordered | 1px `border` token, `surface` fill, no shadow, no gradient. |
| Layout | density | compact, 4px unit | Spacing scale 4 / 8 / 12 / 16 / 24 / 32 / 48. Table rows 36px. Inputs 36px tall on desktop, 44px on touch. |
| Layout | app shell | split-header | Two stacked header bands. Band 1 (48px): wordmark left; alert bell, theme toggle, Google sign-in / avatar right. Band 2 (40px): primary nav as underlined tabs (Dashboard, Password Tools, Questionnaire, Software, Recommendations, Learn). On < 768px, band 2 becomes a bottom tab bar with 5 icons + labels; band 1 stays. No sidebar anywhere. |
| Behavior | motion | gentle | 150–200ms ease-out transitions on hover/focus/expand only. No page-transition animation. Honor `prefers-reduced-motion`. |
| Behavior | theme | light-first | Light is default; dark mode available from the band-1 toggle and follows the same tokens with lightness inverted. |
| Components | score visualization | sparkline-cards | Each category score is a bordered card: large numeral (Sora), category name, one-line "why" sentence, and a 60x20px sparkline of historical snapshots. No radial gauges, no donut charts. |
| Components | empty states | illustrated-geometric | Empty states use an inline SVG built only from circles, lines, and rounded rectangles in primary/accent tints, plus a heading and one CTA. No stock illustrations, no emoji. |

## Non-negotiable accessibility overlays

These apply regardless of seed and take precedence if any seeded token
conflicts with them:

- WCAG 2.2 AA contrast for all text and UI controls (verify with axe in CI).
- Focus ring: 2px solid `primaryStrong`, 2px offset, on every interactive element.
- Touch targets at least 44x44px at widths below 768px.
- Primary screens usable at a 375px viewport with no horizontal scroll.
- Every icon-only control has a visible tooltip on hover/focus and an `aria-label`.

## Implementation contract

- Tokens live in `client/src/styles/tokens.css` as CSS custom properties
  (`--color-primary`, `--space-2`, `--radius`, `--font-heading`, and so on),
  generated once from the seed script and checked in.
- Components import tokens only; no literal colors, radii, or font names in
  component CSS. ESLint/stylelint rule enforces this.
- Google Fonts are loaded with `display=swap` and a system fallback stack.
- The `seed` value is rendered in the site footer as `design seed 3080478562`
  so anyone can reproduce the look.
