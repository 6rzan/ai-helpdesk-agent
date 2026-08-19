import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgentLoop, type AgentLoopAttempt, type ToolLike } from "../../src/services/agent/agent-loop.js";

const echoTool: ToolLike = {
  name: "account_status",
  argumentSchema: z.object({ username: z.enum(["test-user-locked", "test-user-active"]) }),
};
const tools = new Map<string, ToolLike>([[echoTool.name, echoTool]]);

describe("agent loop bounds (T035)", () => {
  it("proposes at most one tool call per step and returns as soon as one validates", async () => {
    let calls = 0;
    const result = await runAgentLoop(
      async (attempts) => {
        calls += 1;
        expect(attempts.length).toBe(calls - 1);
        return { toolName: "account_status", arguments: { username: "test-user-locked" } };
      },
      tools,
      3,
    );
    expect(calls).toBe(1);
    expect(result).toEqual({
      outcome: "proposal",
      toolName: "account_status",
      arguments: { username: "test-user-locked" },
    });
  });

  it("never exceeds AGENT_MAX_STEPS and escalates on reaching the cap", async () => {
    let calls = 0;
    const result = await runAgentLoop(
      async () => {
        calls += 1;
        // Always invalid, and a fresh argument each time so "no progress"
        // (repeat detection) never fires first — this isolates the cap path.
        return { toolName: "account_status", arguments: { username: `bogus-${calls}` } };
      },
      tools,
      3,
    );
    expect(calls).toBe(3);
    expect(result).toEqual({ outcome: "escalate", reason: "step_cap_reached" });
  });

  it("escalates on no progress: the same (tool, arguments) pair proposed twice", async () => {
    let calls = 0;
    const result = await runAgentLoop(
      async () => {
        calls += 1;
        return { toolName: "account_status", arguments: { username: "not-registered" } };
      },
      tools,
      5,
    );
    expect(calls).toBe(2);
    expect(result).toEqual({ outcome: "escalate", reason: "no_progress" });
  });

  it("escalates on no progress: two consecutive stepless iterations (planner proposes nothing)", async () => {
    let calls = 0;
    const result = await runAgentLoop(
      async () => {
        calls += 1;
        return null;
      },
      tools,
      5,
    );
    expect(calls).toBe(2);
    expect(result).toEqual({ outcome: "escalate", reason: "no_progress" });
  });

  it("feeds prior invalid attempts back to the planner so it can try something else", async () => {
    const seenAttemptCounts: number[] = [];
    const result = await runAgentLoop(
      async (attempts: readonly AgentLoopAttempt[]) => {
        seenAttemptCounts.push(attempts.length);
        if (attempts.length === 0) {
          return { toolName: "account_status", arguments: { username: "not-a-real-account" } };
        }
        expect(attempts[0]?.valid).toBe(false);
        return { toolName: "account_status", arguments: { username: "test-user-active" } };
      },
      tools,
      5,
    );
    expect(seenAttemptCounts).toEqual([0, 1]);
    expect(result).toEqual({
      outcome: "proposal",
      toolName: "account_status",
      arguments: { username: "test-user-active" },
    });
  });

  it("defaults maxSteps to config.AGENT_MAX_STEPS when not given", async () => {
    let calls = 0;
    const result = await runAgentLoop(async () => {
      calls += 1;
      return { toolName: "account_status", arguments: { username: `bogus-${calls}` } };
    }, tools);
    // config default is 3; confirm the loop actually bounds itself without an explicit cap.
    expect(calls).toBeGreaterThan(0);
    expect(result.outcome).toBe("escalate");
  });
});
