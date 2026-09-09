import { fileURLToPath } from "node:url";

import type { Knex } from "knex";

/**
 * Connection settings parsed from `DATABASE_URL`.
 *
 * The expected shape is a SQL Server URL:
 *   sqlserver://user:password@host:1433/database?encrypt=true
 *
 * Azure SQL requires `encrypt=true`; the local Docker container does not, so the
 * flag is read from the query string and defaults to on.
 */
export interface DatabaseConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

/**
 * Thrown when `DATABASE_URL` is missing or malformed. The message never contains
 * the URL itself, because the URL carries a password.
 */
export class DatabaseUrlError extends Error {
  constructor(reason: string) {
    super(`DATABASE_URL is invalid: ${reason}`);
    this.name = "DatabaseUrlError";
  }
}

function readBooleanFlag(
  params: URLSearchParams,
  name: string,
  fallback: boolean,
): boolean {
  const raw = params.get(name);

  if (raw === null) {
    return fallback;
  }

  return raw === "true" || raw === "1";
}

export function parseDatabaseUrl(rawUrl: string): DatabaseConnection {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new DatabaseUrlError("it is not a valid URL");
  }

  if (url.protocol !== "sqlserver:" && url.protocol !== "mssql:") {
    throw new DatabaseUrlError("the scheme must be sqlserver: or mssql:");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (database === "") {
    throw new DatabaseUrlError("no database name was given in the path");
  }

  if (url.username === "") {
    throw new DatabaseUrlError("no user was given");
  }

  if (url.password === "") {
    throw new DatabaseUrlError("no password was given");
  }

  const encrypt = readBooleanFlag(url.searchParams, "encrypt", true);

  return {
    host: url.hostname,
    port: url.port === "" ? 1433 : Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    encrypt,
    trustServerCertificate: readBooleanFlag(
      url.searchParams,
      "trustServerCertificate",
      !encrypt,
    ),
  };
}

/**
 * Resolve a directory next to this module so migrations are found whether the
 * server runs from `src/` under tsx or from the compiled `dist/`, and whatever
 * the working directory is.
 */
function resolveDir(name: "migrations" | "seeds"): string {
  return fileURLToPath(new URL(`./${name}/`, import.meta.url));
}

export function knexConfigFor(rawUrl: string): Knex.Config {
  const connection = parseDatabaseUrl(rawUrl);

  return {
    client: "mssql",
    connection: {
      server: connection.host,
      port: connection.port,
      user: connection.user,
      password: connection.password,
      database: connection.database,
      options: {
        encrypt: connection.encrypt,
        trustServerCertificate: connection.trustServerCertificate,
        enableArithAbort: true,
      },
    },
    pool: { min: 0, max: 10 },
    migrations: {
      directory: resolveDir("migrations"),
      extension: "ts",
      loadExtensions: [".ts", ".js"],
      tableName: "knex_migrations",
    },
    seeds: {
      directory: resolveDir("seeds"),
      extension: "ts",
      loadExtensions: [".ts", ".js"],
    },
  };
}

export function requireDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const rawUrl = env.DATABASE_URL;

  if (rawUrl === undefined || rawUrl === "") {
    throw new DatabaseUrlError("it is not set");
  }

  return rawUrl;
}
