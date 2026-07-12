import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decideStepTransition } from "../../src/services/guidance/guidance-service.js";

describe("decideStepTransition", () => {
  it("GT-001: worked resolves the session", () => {
    const decision = decideStepTransition({ outcome: "worked", currentStepIndex: 0, stepCount: 3 });
    expect(decision).toEqual({ action: "resolve" });
  });

  it("GT-002: not_worked advances to the next step when steps remain", () => {
    const decision = decideStepTransition({ outcome: "not_worked", currentStepIndex: 0, stepCount: 3 });
    expect(decision).toEqual({ action: "advance", nextStepIndex: 1, attemptOutcome: "not_worked" });
  });

  it("GT-003: not_worked on the last step escalates instead of advancing", () => {
    const decision = decideStepTransition({ outcome: "not_worked", currentStepIndex: 2, stepCount: 3 });
    expect(decision).toEqual({ action: "escalate", attemptOutcome: "not_worked" });
  });

  it("GT-004: already_tried records the attempt and advances like not_worked", () => {
    const decision = decideStepTransition({ outcome: "already_tried", currentStepIndex: 0, stepCount: 3 });
    expect(decision).toEqual({ action: "advance", nextStepIndex: 1, attemptOutcome: "already_tried" });
  });

  it("GT-005: already_tried on the last step escalates", () => {
    const decision = decideStepTransition({ outcome: "already_tried", currentStepIndex: 2, stepCount: 3 });
    expect(decision).toEqual({ action: "escalate", attemptOutcome: "already_tried" });
  });

  it("GT-006: wants_human escalates immediately", () => {
    const decision = decideStepTransition({ outcome: "wants_human", currentStepIndex: 1, stepCount: 3 });
    expect(decision).toEqual({ action: "escalate" });
  });

  it("GT-007: question holds on the current step", () => {
    const decision = decideStepTransition({ outcome: "question", currentStepIndex: 1, stepCount: 3 });
    expect(decision).toEqual({ action: "hold" });
  });

  it("GT-008: unclear holds on the current step (FR-013 clarify, do not advance)", () => {
    const decision = decideStepTransition({ outcome: "unclear", currentStepIndex: 1, stepCount: 3 });
    expect(decision).toEqual({ action: "hold" });
  });

  it("GT-009: advisory-only guard — the module imports no executor/command modules", () => {
    const path = fileURLToPath(new URL("../../src/services/guidance/guidance-service.ts", import.meta.url));
    const source = readFileSync(path, "utf-8");
    const importLines = source.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/exec|command|shell|process\.js|child_process/);
    }
  });
});
