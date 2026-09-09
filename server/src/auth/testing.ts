import type { AuthConfig } from "./config.js";

/**
 * Auth settings for tests. Not exported from the server entry point and never
 * used at runtime: `createApp` reads the real values from the environment, so a
 * deployment cannot accidentally start with these.
 */
export const TEST_AUTH_CONFIG: AuthConfig = {
  googleClientId: "test-client-id.apps.googleusercontent.com",
  sessionSecret: new TextEncoder().encode(
    "test-session-secret-that-is-long-enough",
  ),
  secureCookies: false,
};
