import type { Knex } from "knex";

import { CATALOG_PATH, loadCatalog, toProductRow } from "../catalog.js";

/**
 * Loads `shared/catalog/products.json` into the `products` table. Idempotent:
 * existing rows are updated in place so user_software foreign keys survive.
 */
export async function seed(knex: Knex): Promise<void> {
  const products = await loadCatalog();

  if (products.length === 0) {
    console.warn(`No product catalog found at ${CATALOG_PATH}; skipping seed.`);
    return;
  }

  const now = new Date();

  for (const product of products) {
    const row = { ...toProductRow(product), updated_at: now };
    const updated = await knex("products").where({ id: row.id }).update(row);

    if (updated === 0) {
      await knex("products").insert(row);
    }
  }

  console.info(`Seeded ${products.length} products.`);
}
