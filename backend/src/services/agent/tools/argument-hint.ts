import { z } from "zod";

// The model only ever sees a tool's `description` (contracts/tools.md,
// consent-service.ts's LLM-facing tool list) — never `argumentSchema` itself.
// Without a hint, it has to guess both the argument key name and the exact
// enum value from prose alone, and reliably gets one or both wrong (observed:
// {"serviceName": "widget"} proposed for a schema that requires exactly
// {"service": "widget-service"}). This derives a compact, always-in-sync
// hint straight from the zod schema so the prompt and the validator can
// never drift apart. LLM-facing only: never mixed into the human-facing
// `description` string shown in chat/audit (consent-service.ts).
export function describeArgumentSchema(schema: z.ZodSchema): string {
  if (!(schema instanceof z.ZodObject)) {
    return "";
  }

  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const keys = Object.keys(shape);
  if (keys.length === 0) {
    return "Call with arguments: {} (this tool takes no arguments).";
  }

  const fields = keys.map((key) => {
    const fieldSchema = shape[key];
    const values = fieldSchema ? enumValues(fieldSchema) : null;
    const valueHint = values ? values.map((v) => JSON.stringify(v)).join(" | ") : "string";
    return `"${key}": ${valueHint}`;
  });

  return `Call with exactly these arguments, no others: {${fields.join(", ")}}.`;
}

function enumValues(schema: z.ZodTypeAny): string[] | null {
  if (schema instanceof z.ZodEnum) {
    return [...schema.options];
  }
  return null;
}
