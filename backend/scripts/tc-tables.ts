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

const RESULTS_PATH = path.resolve("tests/.results/vitest-results.json");
const OUTPUT_PATH = path.resolve("../docs/testing/tc-tables.md");
const TC_PATTERN = /^(TC-\d+)\s*[:\-]?\s*(.*)$/;

async function loadReport(): Promise<VitestJsonReport> {
  const raw = await readFile(RESULTS_PATH, "utf-8");
  return JSON.parse(raw) as VitestJsonReport;
}

function toRows(report: VitestJsonReport): TcRow[] {
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
        suite: path.relative(process.cwd(), suite.name).split(path.sep).join("/"),
        status: assertion.status === "passed" ? "Passed" : "Failed",
        durationMs: assertion.duration != null ? assertion.duration.toFixed(1) : "-",
      });
    }
  }
  rows.sort((a, b) => a.tcNo.localeCompare(b.tcNo, undefined, { numeric: true }));
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
  const report = await loadReport();
  const rows = toRows(report);
  const markdown = `# Chapter 5 Test Case Traceability\n\n${toMarkdown(rows)}`;
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, markdown, "utf-8");
  console.log(`Wrote ${rows.length} TC row(s) to ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
