import { CORE_PERSONA, CORE_SAFETY_NOTE } from "./core.js";
import type { ProposeActionAttempt, ProposeActionTool } from "../types.js";

// Layered per-tool usage prompt (research.md R5 "Plan"): lists only the tools
// registered for the current step, plus what's already been tried this turn,
// so the model never sees — and can never propose — a tool outside the
// registry (contracts/tools.md: tool descriptions are load-bearing interface
// text under Principle VIII).
export function buildProposeActionPrompt(
  tools: ProposeActionTool[],
  attempts: ProposeActionAttempt[],
  stepInstruction: string,
): string {
  const toolLines = tools.length
    ? tools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")
    : "(no tools are available for this step)";

  const attemptLines = attempts.length
    ? attempts
        .map(
          (attempt, index) =>
            `${index + 1}. ${attempt.toolName}(${JSON.stringify(attempt.arguments)}) -> ` +
            (attempt.valid ? "accepted" : "rejected (invalid arguments for that tool)"),
        )
        .join("\n")
    : "(none yet this turn)";

  return (
    `${CORE_PERSONA} You are deciding whether a registered diagnostic or remediation tool would help ` +
    `with the current troubleshooting step:\n"${stepInstruction}"\n\n` +
    "Available tools (propose at most one, using only its exact name, and only arguments its " +
    "description implies are valid):\n" +
    `${toolLines}\n\n` +
    "Attempts already made this turn (never repeat an identical tool-and-arguments pair):\n" +
    `${attemptLines}\n\n` +
    "If no listed tool clearly applies to the current step, or every relevant tool has already been " +
    "tried, propose no tool call.\n" +
    'Respond with strict JSON only: {"toolName": string or null, "arguments": object}. ' +
    "Use toolName: null and arguments: {} to propose nothing.\n" +
    CORE_SAFETY_NOTE
  );
}
