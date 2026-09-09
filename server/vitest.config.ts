import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Run test files one at a time.
     *
     * The integration suites (`*.integration.test.ts`) share a single SQL
     * Server in CI's `db-migrations` job. `schema.integration.test.ts` rolls the
     * whole schema back and re-applies it; `account/delete.integration.test.ts`
     * does the same in its own `beforeAll`. Run in parallel they collide on
     * knex's migration lock ("Migration table is already locked") and on each
     * other's tables. The unit suites are fast enough that serialising every
     * file is a cheaper fix than partial tagging.
     */
    fileParallelism: false,
  },
});
