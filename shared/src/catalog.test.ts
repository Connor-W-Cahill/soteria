import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import { CATALOG_PATH, loadCatalog, products } from "./catalog";

const schema = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../catalog/products.schema.json", import.meta.url)),
    "utf8",
  ),
) as object;

const catalogRaw = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as unknown;

describe("product catalog", () => {
  it("matches products.schema.json", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const valid = validate(catalogRaw);
    if (!valid) {
      throw new Error(ajv.errorsText(validate.errors, { separator: "\n" }));
    }
    expect(valid).toBe(true);
  });

  it("holds 18 to 24 products", () => {
    expect(products.length).toBeGreaterThanOrEqual(18);
    expect(products.length).toBeLessThanOrEqual(24);
  });

  it("uses unique ids", () => {
    const ids = products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses unique cpe vendor/product pairs", () => {
    const pairs = products.map((p) => `${p.cpeVendor}:${p.cpeProduct}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("covers operating systems, browsers, and applications", () => {
    const categories = new Set(products.map((p) => p.category));
    expect(categories).toEqual(
      new Set(["operating-system", "browser", "application"]),
    );
  });

  it("names a platform in every version-lookup help block", () => {
    for (const product of products) {
      expect(product.versionHelp.platform.length).toBeGreaterThan(0);
      expect(product.versionHelp.steps.length).toBeGreaterThan(0);
    }
  });

  it("uses https vendor advisory urls", () => {
    for (const product of products) {
      expect(product.vendorAdvisoryUrl).toMatch(/^https:\/\//);
    }
  });

  it("loadCatalog reads the same file", () => {
    expect(loadCatalog()).toEqual(products);
  });
});
