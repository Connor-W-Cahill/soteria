import knexFactory, { type Knex } from "knex";

import { knexConfigFor, requireDatabaseUrl } from "./config.js";

let instance: Knex | undefined;

/** Lazily created singleton connection pool. */
export function getDb(): Knex {
  if (instance === undefined) {
    instance = knexFactory(knexConfigFor(requireDatabaseUrl()));
  }

  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance !== undefined) {
    await instance.destroy();
    instance = undefined;
  }
}

/**
 * Cheap liveness probe for `GET /api/health`. Returns false rather than throwing
 * so an unconfigured or unreachable database degrades the health payload instead
 * of failing the request.
 */
export async function isDbConnected(): Promise<boolean> {
  try {
    await getDb().raw("select 1 as ok");
    return true;
  } catch {
    return false;
  }
}
