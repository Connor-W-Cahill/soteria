import { createHash } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

/**
 * Pick a dev-server port that is unique to this checkout.
 *
 * Phase 2 runs several agents, each in its own `git worktree`. A single
 * hardcoded port combined with `reuseExistingServer` meant the first worktree to
 * start Vite owned the port and every other worktree's run silently adopted that
 * server — executing its tests against a different tree's source with no warning
 * (#84). Deriving the port from the checkout path makes concurrent worktrees
 * disjoint by construction, with no coordination and nothing to remember.
 *
 * 5200-5699 sits above Vite's 5173 default and well below the ephemeral range.
 */
function derivePort(): number {
  const digest = createHash("sha256").update(process.cwd()).digest();

  return 5200 + (digest.readUInt16BE(0) % 500);
}

const PORT = Number(process.env.SOTERIA_E2E_PORT ?? derivePort());

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
  },
});
