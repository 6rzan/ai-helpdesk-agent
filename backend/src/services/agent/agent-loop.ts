import type { z } from "zod";
import { config } from "../../config/index.js";

// research.md R5 / contracts/tools.md: the bounded plan -> validate -> observe
// cycle. This module never calls the executor and never calls the LLM
// directly — both are injected — so its bounds (step cap, no-progress
// detection) are fully unit-testable without a model or a network call.

export interface ToolCallProposal {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface AgentLoopAttempt {
  proposal: ToolCallProposal;
  /** Did the proposal's own argument schema accept it? Fed back to the planner
   * as observation for the next step, per R5's plan -> validate -> observe cycle. */
  valid: boolean;
}

/** Proposes at most one tool call per step, or none, given what has been tried
 * so far this turn. Returning `null` means "no tool call this step". */
export type Planner = (attempts: readonly AgentLoopAttempt[]) => Promise<ToolCallProposal | null>;

export interface ToolLike {
  name: string;
  argumentSchema: z.ZodSchema;
}

export type AgentLoopResult =
  | { outcome: "proposal"; toolName: string; arguments: Record<string, unknown> }
  | { outcome: "escalate"; reason: "step_cap_reached" | "no_progress" };

function proposalKey(proposal: ToolCallProposal): string {
  return JSON.stringify([proposal.toolName, proposal.arguments]);
}

/**
 * Runs the bounded loop for one employee turn. Stops and returns a validated
 * proposal as soon as one passes its own tool's argument schema — the caller
 * (consent-service, via the policy engine) does the exact policy match,
 * authorisation, and execution from there. Never runs more than `maxSteps`
 * iterations (FR-011); escalates on the cap or on no progress (FR-012).
 */
export async function runAgentLoop(
  planner: Planner,
  tools: ReadonlyMap<string, ToolLike>,
  maxSteps: number = config.AGENT_MAX_STEPS,
): Promise<AgentLoopResult> {
  const attempts: AgentLoopAttempt[] = [];
  let statelessStreak = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    const proposal = await planner(attempts);

    if (!proposal) {
      statelessStreak += 1;
      if (statelessStreak >= 2) {
        return { outcome: "escalate", reason: "no_progress" };
      }
      continue;
    }
    statelessStreak = 0;

    const key = proposalKey(proposal);
    if (attempts.some((attempt) => proposalKey(attempt.proposal) === key)) {
      return { outcome: "escalate", reason: "no_progress" };
    }

    const tool = tools.get(proposal.toolName);
    const valid = tool !== undefined && tool.argumentSchema.safeParse(proposal.arguments).success;
    attempts.push({ proposal, valid });

    if (valid) {
      return { outcome: "proposal", toolName: proposal.toolName, arguments: proposal.arguments };
    }
    // Invalid: the planner sees this failed attempt in `attempts` next step
    // and may propose something else, up to the step cap.
  }

  return { outcome: "escalate", reason: "step_cap_reached" };
}
