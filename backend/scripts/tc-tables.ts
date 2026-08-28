import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface VitestAssertionResult {
  title: string;
  status: "passed" | "failed" | "skipped" | "pending";
  duration: number | null;
}

interface VitestTestResult {
  name: string;
  assertionResults: VitestAssertionResult[];
}

interface VitestJsonReport {
  testResults: VitestTestResult[];
}

interface TcRow {
  tcNo: string;
  description: string;
  suite: string;
  status: string;
  durationMs: string;
}

/** Both packages emit the same vitest JSON report. The frontend's is read when it exists
 * so Chapter 5's table covers the whole test suite rather than only the backend half
 * (007 T053); a missing frontend report is skipped rather than treated as an error, so a
 * backend-only run still regenerates the table. */
const REPORT_SOURCES = [
  { label: "backend", root: path.resolve("."), file: path.resolve("tests/.results/vitest-results.json") },
  { label: "frontend", root: path.resolve("../frontend"), file: path.resolve("../frontend/tests/.results/vitest-results.json") },
];
const OUTPUT_PATH = path.resolve("../docs/testing/tc-tables.md");
/**
 * A case id at the start of a test name.
 *
 * Widened from `TC-\d+` in 007: that feature's suites name their cases with their own
 * prefixes (`SPF-`, `FS-`, `PP-`, `AD-` and so on) because a single global TC counter
 * across nine files is unmaintainable by hand. The table is generated from whatever the
 * tests actually call themselves, which is the point of generating it at all — a
 * hand-written row can disagree with the test it claims to describe, and a generated one
 * cannot.
 */
const TC_PATTERN = /^([A-Z]{2,5}-\d+[a-z]?\d*)\s*[:\-]?\s*(.*)$/;

async function loadReport(file: string): Promise<VitestJsonReport | null> {
  try {
    const raw = await readFile(file, "utf-8");
    return JSON.parse(raw) as VitestJsonReport;
  } catch {
    return null;
  }
}

function toRows(report: VitestJsonReport, label: string, root: string): TcRow[] {
  const rows: TcRow[] = [];
  for (const suite of report.testResults) {
    for (const assertion of suite.assertionResults) {
      const match = TC_PATTERN.exec(assertion.title);
      if (!match) {
        continue;
      }
      const tcNo = match[1] ?? "";
      const description = match[2] && match[2].length > 0 ? match[2] : assertion.title;
      rows.push({
        tcNo,
        description,
        suite: `${label}/${path.relative(root, suite.name).split(path.sep).join("/")}`,
        status: assertion.status === "passed" ? "Passed" : "Failed",
        durationMs: assertion.duration != null ? assertion.duration.toFixed(1) : "-",
      });
    }
  }
  return rows;
}

function toMarkdown(rows: TcRow[]): string {
  const header = "| TC No. | Description | Suite | Status | Duration (ms) |\n|---|---|---|---|---|";
  if (rows.length === 0) {
    return `${header}\n| - | No TC-prefixed tests found | - | - | - |\n`;
  }
  const lines = rows.map(
    (row) => `| ${row.tcNo} | ${row.description} | ${row.suite} | ${row.status} | ${row.durationMs} |`,
  );
  return `${header}\n${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const rows: TcRow[] = [];
  for (const source of REPORT_SOURCES) {
    const report = await loadReport(source.file);
    if (!report) {
      console.warn(`No ${source.label} report at ${source.file}; skipped.`);
      continue;
    }
    rows.push(...toRows(report, source.label, source.root));
  }
  rows.sort((a, b) => a.tcNo.localeCompare(b.tcNo, undefined, { numeric: true }));
  const markdown = `# Chapter 5 Test Case Traceability\n\n${toMarkdown(rows)}`;
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, markdown, "utf-8");
  console.log(`Wrote ${rows.length} TC row(s) to ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
