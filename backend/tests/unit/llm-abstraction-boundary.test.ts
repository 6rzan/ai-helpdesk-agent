import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// T113/Constitution Principle VI: "LLM access flows through exactly one
// provider-abstraction module ... No module besides the abstraction may call
// a model directly." This walks src/ and fails if anything outside
// services/llm/ imports a concrete provider class rather than going through
// the factory (getLlmProvider) / the LlmProvider interface.

const SRC_ROOT = join(__dirname, "..", "..", "src");
const LLM_DIR = join(SRC_ROOT, "services", "llm");

const PROVIDER_CLASS_NAMES = ["MockLlmProvider", "OllamaProvider", "OpenAiCompatProvider", "ChainedLlmProvider"];

function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listFilesRecursive(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("LLM provider abstraction boundary (Constitution Principle VI)", () => {
  it("is imported by no module outside services/llm/", () => {
    const violations: string[] = [];

    for (const file of listFilesRecursive(SRC_ROOT)) {
      if (file.startsWith(LLM_DIR)) {
        continue;
      }
      const content = readFileSync(file, "utf-8");
      for (const className of PROVIDER_CLASS_NAMES) {
        // Matches named imports of the class, e.g. `import { OllamaProvider }`
        // or `import { OllamaProvider as X }`, without flagging the string
        // appearing incidentally in a comment or unrelated identifier.
        const importPattern = new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\b${className}\\b[^}]*\\}\\s+from`);
        if (importPattern.test(content)) {
          violations.push(`${relative(SRC_ROOT, file)} imports ${className} directly`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
