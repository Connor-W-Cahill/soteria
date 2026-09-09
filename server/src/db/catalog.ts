import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { z } from "zod";

/**
 * Reader for the curated product catalog owned by INF-07
 * (`shared/catalog/products.json`). The seed is the only consumer.
 *
 * `versionHelp` is accepted either as a single string or as a structured
 * `{ platform, steps }` object, because the catalog is authored separately; both
 * shapes normalise to one paragraph of text plus an optional platform label.
 */

const versionHelpSchema = z.union([
  z.string().min(1),
  z.object({
    platform: z.string().min(1).optional(),
    steps: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  }),
]);

const productSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  vendor: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  cpeVendor: z.string().min(1).max(120),
  cpeProduct: z.string().min(1).max(120),
  versionScheme: z.enum(["semver", "build", "marketing"]),
  versionHelp: versionHelpSchema,
  versionHelpPlatform: z.string().min(1).max(80).optional(),
  vendorAdvisoryUrl: z.string().url().max(500),
});

const catalogSchema = z.union([
  z.array(productSchema),
  z.object({ products: z.array(productSchema) }),
]);

export type CatalogProduct = z.infer<typeof productSchema>;

/** Row shape expected by the `products` table. */
export interface ProductRow {
  id: string;
  name: string;
  vendor: string;
  category: string;
  cpe_vendor: string;
  cpe_product: string;
  version_scheme: string;
  version_help: string;
  version_help_platform: string | null;
  vendor_advisory_url: string;
}

export function toProductRow(product: CatalogProduct): ProductRow {
  const help = product.versionHelp;
  const isStructured = typeof help !== "string";
  const steps = isStructured ? help.steps : help;

  return {
    id: product.id,
    name: product.name,
    vendor: product.vendor,
    category: product.category,
    cpe_vendor: product.cpeVendor,
    cpe_product: product.cpeProduct,
    version_scheme: product.versionScheme,
    version_help: Array.isArray(steps) ? steps.join("\n") : steps,
    version_help_platform:
      (isStructured ? help.platform : undefined) ??
      product.versionHelpPlatform ??
      null,
    vendor_advisory_url: product.vendorAdvisoryUrl,
  };
}

export const CATALOG_PATH = fileURLToPath(
  new URL("../../../shared/catalog/products.json", import.meta.url),
);

export function parseCatalog(raw: string): CatalogProduct[] {
  const parsed = catalogSchema.parse(JSON.parse(raw));

  return Array.isArray(parsed) ? parsed : parsed.products;
}

/**
 * Returns the catalog, or an empty array when the file does not exist yet.
 * INF-07 delivers the file; migrations and seeds must not hard-fail before then.
 */
export async function loadCatalog(
  path: string = CATALOG_PATH,
): Promise<CatalogProduct[]> {
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return parseCatalog(raw);
}
