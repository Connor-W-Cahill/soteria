import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Playwright specs live in e2e/ and are run via `npm run playwright`.
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
});
