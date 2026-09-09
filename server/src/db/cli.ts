/**
 * Migration and seed runner. Used instead of the `knex` binary because npm
 * workspaces hoist `knex` to the root `node_modules`, so `server/node_modules/
 * knex/bin/cli.js` does not exist in CI.
 *
 * Usage: tsx src/db/cli.ts <migrate|rollback|seed|status>
 */
import knexFactory from "knex";

import { knexConfigFor, requireDatabaseUrl } from "./config.js";

const COMMANDS = ["migrate", "rollback", "seed", "status"] as const;
type Command = (typeof COMMANDS)[number];

function parseCommand(argument: string | undefined): Command {
  if (
    argument !== undefined &&
    (COMMANDS as readonly string[]).includes(argument)
  ) {
    return argument as Command;
  }

  throw new Error(`Usage: db-cli <${COMMANDS.join("|")}>`);
}

const command = parseCommand(process.argv[2]);
const db = knexFactory(knexConfigFor(requireDatabaseUrl()));

try {
  switch (command) {
    case "migrate": {
      const [batch, applied] = (await db.migrate.latest()) as [
        number,
        string[],
      ];

      console.info(
        applied.length === 0
          ? "No migrations to run; the schema is up to date."
          : `Batch ${batch} applied ${applied.length} migration(s):\n  ${applied.join("\n  ")}`,
      );
      break;
    }

    case "rollback": {
      const [batch, reverted] = (await db.migrate.rollback()) as [
        number,
        string[],
      ];

      console.info(
        reverted.length === 0
          ? "Nothing to roll back."
          : `Batch ${batch} rolled back ${reverted.length} migration(s).`,
      );
      break;
    }

    case "seed": {
      const [run] = (await db.seed.run()) as [string[]];
      console.info(`Ran ${run.length} seed file(s).`);
      break;
    }

    case "status": {
      const current = await db.migrate.currentVersion();
      console.info(`Current migration version: ${current}`);
      break;
    }
  }
} finally {
  await db.destroy();
}
