export const APPLICATION_NAME = "Soteria";

export * from "./catalog.js";

export interface HealthResponse {
  status: "ok";
  version: string;
  dbConnected: boolean;
}

export * from "./password/hibp.js";
