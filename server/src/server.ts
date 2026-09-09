import { createApp } from "./app.js";
import pino from "pino";

const port = Number(process.env.PORT ?? 3000);
const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

createApp().listen(port, () => {
  logger.info({ port }, "Soteria API listening");
});
