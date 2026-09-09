export const APPLICATION_NAME = "Soteria";

export * from "./catalog.js";
export * from "./password/generate.js";
export * from "./password/passphrase.js";

/** The signed-in user, as `GET /api/me` reports them. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
}

/** `GET /api/me`. `user` is null when the request carries no valid session. */
export interface MeResponse {
  user: SessionUser | null;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  dbConnected: boolean;
}

export * from "./password/hibp.js";
