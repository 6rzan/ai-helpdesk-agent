import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { connectDb } from "./lib/db.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, mode: config.APP_MODE }, "server started");
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, "failed to start server");
  process.exit(1);
});
