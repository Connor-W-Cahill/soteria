import catalogFile from "../catalog/products.json" with { type: "json" };

/**
 * The curated product catalog (INF-07). Consumers: the INF-04 database seed and
 * the CVE matcher (US-24), which needs a CPE vendor/product pair per product and
 * a `versionScheme` to pick a version comparator.
 */

export type ProductCategory = "operating-system" | "browser" | "application";

/** How a product numbers its releases; drives the matcher's version comparator. */
export type VersionScheme = "semver" | "build" | "marketing";

/** Plain-language, per-platform steps for finding an installed version (US-22). */
export interface VersionHelp {
  platform: string;
  steps: string[];
}

export interface CatalogProduct {
  /** Stable kebab-case identifier; the `products` table primary key. */
  id: string;
  name: string;
  vendor: string;
  category: ProductCategory;
  /** Vendor field of the NVD CPE 2.3 name. Verified against the NVD dictionary. */
  cpeVendor: string;
  /** Product field of the NVD CPE 2.3 name. Verified against the NVD dictionary. */
  cpeProduct: string;
  versionScheme: VersionScheme;
  versionHelp: VersionHelp;
  /** Official vendor security-advisory or release-notes page. */
  vendorAdvisoryUrl: string;
}

interface CatalogFile {
  products: CatalogProduct[];
}

/**
 * Parse catalog entries from raw JSON text. Kept for callers that hold the file
 * as text — the seed reads it from disk on the server.
 */
export function parseCatalog(raw: string): CatalogProduct[] {
  const data = JSON.parse(raw) as CatalogFile;
  return data.products;
}

/**
 * The catalog, imported as a module rather than read from disk.
 *
 * This package is shared by the browser and the server, so it must not depend
 * on a Node built-in: `shared/` is "types and pure rule modules used by both"
 * (IMPLEMENTATION_PLAN section 2). A `readFileSync` here — executed at module
 * scope, no less — made every import of `@soteria/shared` fail in the browser.
 * A JSON import is resolved by the bundler for the client and natively by Node
 * on the server, so both tiers get the same data with no filesystem access.
 */
export const products: CatalogProduct[] = (catalogFile as CatalogFile).products;

/** Look up a single product by `id`. */
export function getProduct(id: string): CatalogProduct | undefined {
  return products.find((product) => product.id === id);
}
