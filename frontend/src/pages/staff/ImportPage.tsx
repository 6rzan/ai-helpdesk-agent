import { useState } from "react";
import { ApiError, applyImport, mapImport, previewImport, uploadImport } from "../../services/api";
import type { ImportField, ImportOutcome } from "../../lib/types";

const fields: ImportField[] = ["email", "displayName", "initialPassword", "remoteAccessId", "location", "hardware"];
type Step = "upload" | "mapping" | "preview" | "applying" | "applied" | "error";

export function ImportPage() {
  const [id, setId] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportField | "">>({});
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  const [step, setStep] = useState<Step>("upload");
  const [lastStep, setLastStep] = useState<"upload" | "preview" | "apply">("upload");
  const [error, setError] = useState("");

  const fail = (failedStep: typeof lastStep, cause: unknown) => {
    setLastStep(failedStep);
    setStep("error");
    setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Import request failed");
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setError(""); setStep("upload");
    try { const result = await uploadImport(file); setId(result.importId); setColumns(result.columns); setOutcomes([]); setStep("mapping"); }
    catch (cause) { fail("upload", cause); }
  };
  const preview = async () => {
    setError(""); setStep("preview");
    try { await mapImport(id, Object.fromEntries(Object.entries(mapping).filter(([, value]) => value)) as Record<string, ImportField>); const result = await previewImport(id); setOutcomes(result.outcomes); setStep("preview"); }
    catch (cause) { fail("preview", cause); }
  };
  const apply = async () => {
    setError(""); setStep("applying");
    try { const result = await applyImport(id); setOutcomes(result.outcomes); setStep("applied"); }
    catch (cause) { fail("apply", cause); }
  };
  const retry = () => { if (lastStep === "preview") void preview(); else if (lastStep === "apply") void apply(); };
  const busy = step === "applying";

  return <main className="mx-auto max-w-4xl p-6">
    <h1 className="text-2xl font-semibold">Import users</h1>
    <p className="mt-1 text-sm text-gray-600">Upload, map, preview, then apply. Nothing changes before apply.</p>
    <p className="mt-2 text-sm text-gray-500" role="status">Step: {step === "applying" ? "applying" : step}</p>
    <label className="mt-6 block text-sm font-medium">Excel workbook
      <input disabled={busy || step === "applied"} className="mt-2 block" type="file" accept=".xlsx" onChange={(event) => void upload(event.target.files?.[0])} />
    </label>
    {columns.length > 0 && step !== "applied" && <section className="mt-6 rounded border p-4">
      <h2 className="font-semibold">Column mapping</h2>
      {columns.map((column) => <label key={column} className="mt-3 flex items-center gap-3 text-sm">{column}
        <select disabled={busy} value={mapping[column] ?? ""} onChange={(event) => setMapping({ ...mapping, [column]: event.target.value as ImportField | "" })}>
          <option value="">Ignore</option>{fields.map((field) => <option key={field} value={field}>{field}</option>)}
        </select>
      </label>)}
      <button disabled={busy} className="mt-5 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" onClick={() => void preview()}>{busy ? "Working…" : "Preview"}</button>
    </section>}
    {step === "preview" && outcomes.length > 0 && <section className="mt-6"><h2 className="font-semibold">Preview outcomes</h2><OutcomeTable outcomes={outcomes} /><button className="mt-5 rounded bg-emerald-700 px-4 py-2 text-white" onClick={() => void apply()}>Apply import</button></section>}
    {step === "applying" && <p className="mt-5" role="status">Applying import…</p>}
    {step === "applied" && <section className="mt-6"><h2 className="font-semibold">Applied outcomes</h2><OutcomeTable outcomes={outcomes} /></section>}
    {step === "error" && <div className="mt-5"><p role="alert" className="text-red-700">{error}</p>{lastStep !== "upload" && <button className="mt-2 text-sm font-medium text-blue-600" onClick={retry}>Retry {lastStep}</button>}</div>}
  </main>;
}

function OutcomeTable({ outcomes }: { outcomes: ImportOutcome[] }) {
  return <table className="mt-2 w-full text-left text-sm"><tbody>{outcomes.map((outcome) => <tr key={outcome.row} className="border-b"><td className="p-2">{outcome.row}</td><td>{outcome.email}</td><td><span className="rounded bg-gray-100 px-2 py-0.5">{outcome.outcome}</span></td><td>{outcome.reason ?? outcome.initialPassword ?? ""}</td></tr>)}</tbody></table>;
}
