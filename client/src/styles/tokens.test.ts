import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../");

describe("design tokens", () => {
  const css = readFileSync(resolve(here, "tokens.css"), "utf8");
  const seed = JSON.parse(
    execFileSync(
      "node",
      [resolve(repoRoot, "docs/design/derive-seed.mjs"), "3080478562"],
      {
        encoding: "utf8",
      },
    ),
  );

  it("is generated from the project seed", () => {
    expect(css).toContain('--seed: "3080478562"');
  });

  it("uses the seeded primary color verbatim", () => {
    expect(css).toContain(`--color-primary: ${seed.color.primary};`);
  });

  it("uses the seeded fonts", () => {
    expect(css).toContain(`"${seed.type.heading}"`);
    expect(css).toContain(`"${seed.type.body}"`);
    expect(css).toContain(`"${seed.type.mono}"`);
  });

  it("defines a dark-mode override block", () => {
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("prefers-color-scheme: dark");
  });
});
