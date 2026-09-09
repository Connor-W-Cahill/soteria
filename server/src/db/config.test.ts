import { describe, expect, it } from "vitest";

import {
  DatabaseUrlError,
  knexConfigFor,
  parseDatabaseUrl,
  requireDatabaseUrl,
} from "./config.js";

const LOCAL_URL =
  "sqlserver://sa:Soteria_local_dev_1@localhost:1433/soteria?encrypt=false";

describe("parseDatabaseUrl", () => {
  it("parses a local development URL", () => {
    expect(parseDatabaseUrl(LOCAL_URL)).toEqual({
      host: "localhost",
      port: 1433,
      user: "sa",
      password: "Soteria_local_dev_1",
      database: "soteria",
      encrypt: false,
      trustServerCertificate: true,
    });
  });

  it("defaults to encrypted connections, as Azure SQL requires", () => {
    const connection = parseDatabaseUrl(
      "sqlserver://app:secret@soteria.database.windows.net/soteria",
    );

    expect(connection.encrypt).toBe(true);
    expect(connection.trustServerCertificate).toBe(false);
    expect(connection.port).toBe(1433);
  });

  it("decodes percent-encoded credentials", () => {
    const connection = parseDatabaseUrl(
      "sqlserver://a%40b:p%40ss%2Fword@db.example/soteria",
    );

    expect(connection.user).toBe("a@b");
    expect(connection.password).toBe("p@ss/word");
  });

  it.each([
    ["not-a-url", "not a valid URL"],
    ["postgres://u:p@host/db", "wrong scheme"],
    ["sqlserver://u:p@host/", "missing database"],
    ["sqlserver://host/db", "missing user"],
    ["sqlserver://u@host/db", "missing password"],
  ])("rejects %s (%s)", (rawUrl) => {
    expect(() => parseDatabaseUrl(rawUrl)).toThrow(DatabaseUrlError);
  });

  it("never repeats the URL or the password in the error message", () => {
    let message = "";

    try {
      parseDatabaseUrl("sqlserver://u:hunter2@host/");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("sqlserver://");
  });
});

describe("knexConfigFor", () => {
  it("builds an mssql config with the migration and seed directories", () => {
    const config = knexConfigFor(LOCAL_URL);

    expect(config.client).toBe("mssql");
    expect(config.migrations?.directory).toMatch(/db[/\\]migrations[/\\]?$/);
    expect(config.seeds?.directory).toMatch(/db[/\\]seeds[/\\]?$/);
  });
});

describe("requireDatabaseUrl", () => {
  it("throws when DATABASE_URL is unset or empty", () => {
    expect(() => requireDatabaseUrl({})).toThrow(DatabaseUrlError);
    expect(() => requireDatabaseUrl({ DATABASE_URL: "" })).toThrow(
      DatabaseUrlError,
    );
  });

  it("returns the raw value when set", () => {
    expect(requireDatabaseUrl({ DATABASE_URL: LOCAL_URL })).toBe(LOCAL_URL);
  });
});
