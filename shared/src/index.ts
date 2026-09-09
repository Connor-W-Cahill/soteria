export const APPLICATION_NAME = "Soteria";

export interface HealthResponse {
  status: "ok";
  version: string;
  dbConnected: boolean;
}
