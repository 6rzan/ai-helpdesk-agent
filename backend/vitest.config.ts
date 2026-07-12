import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      APP_MODE: "test",
      LLM_PROVIDER: "mock",
      MAINTAINER_KEY: "test-maintainer-key",
    },
    reporters: ["default", "json"],
    outputFile: {
      json: "./tests/.results/vitest-results.json",
    },
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
