import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { connectDb } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { setExecutor } from "./services/remediation/policy-engine.js";
import { executeViaSsh } from "./services/remediation/executor.js";
import { validateToolRegistry } from "./services/agent/tools/index.js";

async function main(): Promise<void> {
  await connectDb();

  // Wired only here, not in app.ts, so the mongodb-memory-server-backed test
  // suite never opens a real SSH connection by default — integration tests
  // inject a stub via setExecutorForTest instead (Constitution Principle IV).
  setExecutor(executeViaSsh);

  const registryErrors = validateToolRegistry();
  if (registryErrors.length > 0) {
    logger.error({ registryErrors }, "agent tool registry failed startup validation (FR-013)");
  }

  const app = createApp();
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, mode: config.APP_MODE }, "server started");
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, "failed to start server");
  process.exit(1);
});
