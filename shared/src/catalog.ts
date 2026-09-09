import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

export const CATALOG_PATH = fileURLToPath(
  new URL("../catalog/products.json", import.meta.url),
);

/** Parse and return the catalog entries from raw JSON text. */
export function parseCatalog(raw: string): CatalogProduct[] {
  const data = JSON.parse(raw) as CatalogFile;
  return data.products;
}

/** Load the catalog from disk (defaults to the bundled `products.json`). */
export function loadCatalog(path: string = CATALOG_PATH): CatalogProduct[] {
  return parseCatalog(readFileSync(path, "utf8"));
}

/** The catalog, loaded once at module init. */
export const products: CatalogProduct[] = loadCatalog();

/** Look up a single product by `id`. */
export function getProduct(id: string): CatalogProduct | undefined {
  return products.find((product) => product.id === id);
}
