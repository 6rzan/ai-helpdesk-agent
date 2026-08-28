import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    // Same JSON report the backend already emits, so `npm run tc-tables` can generate
    // Chapter 5's table from both packages rather than only from the backend (007 T053).
    reporters: ["default", "json"],
    outputFile: { json: "./tests/.results/vitest-results.json" },
  },
});
