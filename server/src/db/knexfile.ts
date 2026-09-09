/** Entry point for the knex CLI: `npm run db:migrate` and friends. */
import { knexConfigFor, requireDatabaseUrl } from "./config.js";

export default knexConfigFor(requireDatabaseUrl());
