import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      APP_MODE: "test",
      LLM_PROVIDER: "mock",
      MAINTAINER_KEY: "test-maintainer-key",
      MONGOMS_MAX_STARTUP_TIME: "60000",
    },
    reporters: ["default", "json"],
    outputFile: {
      json: "./tests/.results/vitest-results.json",
    },
    hookTimeout: 30_000,
    testTimeout: 15_000,
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    isolate: true,
  },
});
