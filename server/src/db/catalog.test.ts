import { describe, expect, it } from "vitest";

import { loadCatalog, parseCatalog, toProductRow } from "./catalog.js";

const FIREFOX = {
  id: "firefox",
  name: "Firefox",
  vendor: "Mozilla",
  category: "browser",
  cpeVendor: "mozilla",
  cpeProduct: "firefox",
  versionScheme: "semver",
  versionHelp: "Open the menu, choose Help, then About Firefox.",
  vendorAdvisoryUrl: "https://www.mozilla.org/security/advisories/",
} as const;

describe("parseCatalog", () => {
  it("accepts a bare array and an object with a products key", () => {
    expect(parseCatalog(JSON.stringify([FIREFOX]))).toHaveLength(1);
    expect(parseCatalog(JSON.stringify({ products: [FIREFOX] }))).toHaveLength(
      1,
    );
  });

  it("rejects an unknown version scheme", () => {
    expect(() =>
      parseCatalog(JSON.stringify([{ ...FIREFOX, versionScheme: "calendar" }])),
    ).toThrow();
  });
});

describe("toProductRow", () => {
  it("maps a string versionHelp to snake_case columns", () => {
    expect(toProductRow(FIREFOX)).toEqual({
      id: "firefox",
      name: "Firefox",
      vendor: "Mozilla",
      category: "browser",
      cpe_vendor: "mozilla",
      cpe_product: "firefox",
      version_scheme: "semver",
      version_help: "Open the menu, choose Help, then About Firefox.",
      version_help_platform: null,
      vendor_advisory_url: "https://www.mozilla.org/security/advisories/",
    });
  });

  it("flattens structured version help and keeps the platform label", () => {
    const row = toProductRow({
      ...FIREFOX,
      versionHelp: {
        platform: "Windows",
        steps: ["Open the menu.", "Click About."],
      },
    });

    expect(row.version_help).toBe("Open the menu.\nClick About.");
    expect(row.version_help_platform).toBe("Windows");
  });
});

describe("loadCatalog", () => {
  it("returns an empty catalog when the file does not exist yet", async () => {
    await expect(loadCatalog("/nonexistent/products.json")).resolves.toEqual(
      [],
    );
  });
});
