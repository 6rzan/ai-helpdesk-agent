import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { classify } from "../../src/services/classification/classifier.js";
import { OllamaProvider } from "../../src/services/llm/ollama-provider.js";
import { OpenAiCompatProvider } from "../../src/services/llm/openai-compat-provider.js";
import type { IssueCategory } from "../../src/models/enums.js";

interface BenchmarkFixture {
  id: string;
  category: IssueCategory | "ambiguous" | "out_of_scope";
  text: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures: BenchmarkFixture[] = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/reports.json"), "utf-8"),
);

// Bypasses getLlmProvider(), which vitest.config.ts forces to "mock" for every test run.
// LLM_BASE_URL set ⇒ OpenAI-compatible server (e.g. LM Studio); otherwise Ollama.
const provider = process.env.LLM_BASE_URL ? new OpenAiCompatProvider() : new OllamaProvider();

describe("classification benchmark (real local LLM, opt-in)", () => {
  let ollamaReachable = false;

  beforeAll(async () => {
    ollamaReachable = await provider.health();
  }, 15_000);

  it(
    "TC-025: classifies the benchmark set at >=80% accuracy with <=5% confident misclassification, within SC-008 latency",
    async () => {
      if (!ollamaReachable) {
        console.warn(
          `Ollama not reachable — skipping benchmark assertions. Start Ollama and pull the configured model to run this test.`,
        );
        return;
      }

      let correct = 0;
      let confidentlyWrong = 0;
      const latenciesMs: number[] = [];

      for (const fixture of fixtures) {
        const start = Date.now();
        const outcome = await classify({ history: [], latestMessage: fixture.text }, provider);
        latenciesMs.push(Date.now() - start);

        const isRealCategory = fixture.category !== "ambiguous" && fixture.category !== "out_of_scope";

        if (isRealCategory) {
          if (outcome.outcome === "classified" && outcome.category === fixture.category) {
            correct += 1;
          } else if (outcome.outcome === "classified") {
            confidentlyWrong += 1;
          }
        } else {
          // Safe outcomes for ambiguous/out-of-scope reports: a clarifying question, or an
          // explicit "unclassified" flag — never a confident, specific wrong category (SC-003).
          if (
            outcome.outcome === "needs_clarification" ||
            (outcome.outcome === "classified" && outcome.category === "unclassified")
          ) {
            correct += 1;
          } else if (outcome.outcome === "classified") {
            confidentlyWrong += 1;
          }
        }
      }

      const total = fixtures.length;
      const accuracy = correct / total;
      const confidentWrongRate = confidentlyWrong / total;

      const sortedLatencies = [...latenciesMs].sort((a, b) => a - b);
      const p90Index = Math.min(sortedLatencies.length - 1, Math.ceil(sortedLatencies.length * 0.9) - 1);
      const p90LatencyMs = sortedLatencies[p90Index];

      console.log(
        `benchmark: accuracy=${(accuracy * 100).toFixed(1)}% confidentWrongRate=${(confidentWrongRate * 100).toFixed(1)}% p90Latency=${p90LatencyMs}ms (n=${total})`,
      );

      expect(accuracy).toBeGreaterThanOrEqual(0.8);
      expect(confidentWrongRate).toBeLessThanOrEqual(0.05);
      expect(p90LatencyMs).toBeLessThanOrEqual(10_000);
    },
    10 * 60_000,
  );
});
