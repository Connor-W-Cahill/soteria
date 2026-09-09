import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Regression guard for #69.
 *
 * `shared/` is "types and pure rule modules used by both" tiers
 * (IMPLEMENTATION_PLAN section 2), so nothing reachable from its barrel may
 * depend on a Node built-in. It did once — `catalog.ts` called `readFileSync`
 * at module scope — which made every browser import of `@soteria/shared` fail
 * at load, and no test noticed because the package's own suite runs in Node.
 *
 * This walks the real import graph from `index.ts` rather than checking a fixed
 * list of files, so a Node import reintroduced anywhere behind the barrel fails
 * here.
 */

const NODE_BUILTIN =
  /from\s+["'](?:node:[a-z_/]+|fs|path|url|os|crypto|child_process|worker_threads)["']/;
const RELATIVE_IMPORT = /from\s+["'](\.[^"']*)["']/g;

const srcDir = fileURLToPath(new URL(".", import.meta.url));

function resolve(specifier: string, fromDir: string): string | undefined {
  const base = fileURLToPath(new URL(specifier, `file://${fromDir}/`));
  const candidates = [
    base.replace(/\.js$/, ".ts"),
    `${base}.ts`,
    `${base}/index.ts`,
    base,
  ];

  return candidates.find((candidate) => {
    try {
      readFileSync(candidate, "utf8");
      return true;
    } catch {
      return false;
    }
  });
}

/** Every module reachable from `index.ts`, following relative imports. */
function reachableFromBarrel(): Map<string, string> {
  const seen = new Map<string, string>();
  const queue = [`${srcDir}index.ts`];

  while (queue.length > 0) {
    const file = queue.pop() as string;

    if (seen.has(file)) {
      continue;
    }

    const source = readFileSync(file, "utf8");
    seen.set(file, source);

    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const specifier = match[1] as string;
      const resolved = resolve(specifier, file.slice(0, file.lastIndexOf("/")));

      if (resolved !== undefined && resolved.endsWith(".ts")) {
        queue.push(resolved);
      }
    }
  }

  return seen;
}

describe("the shared barrel is browser-safe", () => {
  const modules = reachableFromBarrel();

  it("reaches more than just index.ts, so the walk is really working", () => {
    expect(modules.size).toBeGreaterThan(1);
    expect(
      [...modules.keys()].some((file) => file.endsWith("catalog.ts")),
    ).toBe(true);
  });

  it("imports no Node built-in anywhere behind index.ts", () => {
    const offenders = [...modules.entries()]
      .filter(([, source]) => NODE_BUILTIN.test(source))
      .map(([file]) => file.replace(srcDir, ""));

    expect(offenders).toEqual([]);
  });

  it("detects a Node import if one is reintroduced", () => {
    // Proves the matcher itself works, so the assertion above cannot pass
    // vacuously.
    expect(NODE_BUILTIN.test('import { readFileSync } from "node:fs";')).toBe(
      true,
    );
    expect(NODE_BUILTIN.test('import { fileURLToPath } from "node:url";')).toBe(
      true,
    );
    expect(NODE_BUILTIN.test('import { z } from "zod";')).toBe(false);
    expect(
      NODE_BUILTIN.test('import { splitDigest } from "./password/hibp.js";'),
    ).toBe(false);
  });

  it("only exempts test files, which run in Node", () => {
    const tests = readdirSync(srcDir).filter((name) =>
      name.endsWith(".test.ts"),
    );

    expect(tests.length).toBeGreaterThan(0);
    for (const file of tests) {
      expect(modules.has(`${srcDir}${file}`)).toBe(false);
    }
  });
});
