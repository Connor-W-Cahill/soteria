import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

/**
 * Pick a dev-server port this checkout can actually have to itself.
 *
 * Phase 2 runs several agents, each in its own `git worktree`. A single hardcoded
 * port combined with `reuseExistingServer` meant the first worktree to start Vite
 * owned the port and every other worktree's run silently adopted that server,
 * testing a different tree's source with no warning (#84).
 *
 * Deriving the port from the checkout path fixed that, but only probabilistically:
 * a 500-bucket modulo collided in practice, and three active worktrees mapped to
 * 5368 at once, which blocked them from running concurrently (#94).
 *
 * So the derived value is only a starting point: scan upward for a port nothing is
 * listening on. That keeps the port stable per worktree whenever it is free, which
 * is convenient when debugging, without depending on luck.
 *
 * The safety property is preserved, and it never depended on the port being fixed:
 * the chosen port is one where nothing is listening, and `reuseExistingServer`
 * stays false with `--strictPort`, so a run can only ever talk to a server it
 * started itself.
 */
function derivePort(): number {
  const digest = createHash("sha256").update(process.cwd()).digest();

  // 5200-7199 sits above Vite's 5173 default and well below the ephemeral range.
  return 5200 + (digest.readUInt32BE(0) % 2000);
}

function isFree(port: number): boolean {
  // A synchronous probe, because the config is evaluated synchronously. Binding
  // and immediately releasing answers the question --strictPort will ask: could
  // our own Vite take this port?
  //
  // Both address families must be free. Probing only 127.0.0.1 reported a busy
  // port as free when a server held [::1] alone — which is how Vite binds here —
  // so the scan handed back a port Playwright then refused.
  const probe = spawnSync(
    process.execPath,
    [
      "-e",
      `const net = require("node:net");
       let left = 2;
       let ok = true;
       for (const host of ["127.0.0.1", "::1"]) {
         const s = net.createServer();
         s.once("error", () => { ok = false; if (--left === 0) done(); });
         s.listen(${port}, host, () => s.close(() => { if (--left === 0) done(); }));
       }
       function done() { process.exit(ok ? 0 : 1); }`,
    ],
    { stdio: "ignore" },
  );

  return probe.status === 0;
}

function choosePort(): number {
  // Pin the choice for the whole run. Playwright evaluates this config in the
  // main process AND again in every worker process, and once Vite has taken the
  // port a later evaluation sees it busy and would scan past it — so the workers
  // would end up pointed at a different port than the server was started on.
  // Publishing the decision into the environment means every later evaluation,
  // in this process or an inherited child, reads back the same answer.
  const pinned = process.env.SOTERIA_E2E_PORT;

  if (pinned !== undefined && pinned !== "") {
    return Number(pinned);
  }

  const start = derivePort();

  for (let offset = 0; offset < 200; offset++) {
    const candidate = start + offset;

    if (isFree(candidate)) {
      process.env.SOTERIA_E2E_PORT = String(candidate);

      return candidate;
    }
  }

  throw new Error(
    `No free e2e port found in ${start}..${start + 199}. Set SOTERIA_E2E_PORT.`,
  );
}

const PORT = choosePort();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-375",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 780 },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    port: PORT,
    // Never adopt a server this run did not start. With `--strictPort`, a port
    // that is somehow already taken now fails loudly instead of quietly testing
    // whatever code that other server happens to be serving.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // A placeholder client id so the Google Identity script is actually
      // requested on /signin (US-14). Without one the button short-circuits to
      // "not configured" and signin.spec.ts could not tell a working lazy load
      // from a silently broken one. It authenticates nothing: sign-in cannot
      // complete against it, and no test tries to.
      VITE_GOOGLE_CLIENT_ID:
        process.env.VITE_GOOGLE_CLIENT_ID ??
        "e2e-placeholder.apps.googleusercontent.com",
    },
  },
});
