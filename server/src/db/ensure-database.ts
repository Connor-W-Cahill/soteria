/**
 * Creates the database named in `DATABASE_URL` if it does not exist, by
 * connecting to `master` first. Azure SQL provisions the database up front
 * (INF-05), so this is for local Docker and CI only.
 */
import knexFactory from "knex";

import {
  knexConfigFor,
  parseDatabaseUrl,
  requireDatabaseUrl,
} from "./config.js";

export async function ensureDatabase(rawUrl: string): Promise<string> {
  const { database } = parseDatabaseUrl(rawUrl);

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)) {
    throw new Error(
      "The database name in DATABASE_URL is not a plain identifier.",
    );
  }

  const master = knexFactory({
    ...knexConfigFor(rawUrl),
    connection: {
      ...(knexConfigFor(rawUrl).connection as Record<string, unknown>),
      database: "master",
    },
  });

  try {
    await master.raw(
      `IF DB_ID('${database}') IS NULL EXEC('CREATE DATABASE [${database}]')`,
    );
  } finally {
    await master.destroy();
  }

  return database;
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  process.argv[1].endsWith("ensure-database.ts");

if (isEntryPoint) {
  const name = await ensureDatabase(requireDatabaseUrl());
  console.info(`Database ${name} is ready.`);
}
