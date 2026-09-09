import { createApp } from "./app.js";
import { closeDb } from "./db/knex.js";
import { logger } from "./logging/logger.js";

const port = Number(process.env.PORT ?? 3000);
const server = createApp().listen(port, () => {
  logger.info({ port }, "Soteria API listening");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "Shutting down");
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
  });
}
