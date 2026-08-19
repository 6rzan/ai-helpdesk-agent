import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { startTestApp, stopTestApp } from "../helpers/test-app.js";
import { getRegisteredTools, getToolRegistryMap, validateToolRegistry } from "../../src/services/agent/tools/index.js";

describe("agent tool registry", () => {
  beforeAll(async () => {
    await startTestApp();
  });
  afterAll(async () => {
    await stopTestApp();
  });

  it("registers exactly the five read-only tools for US1", () => {
    const names = getRegisteredTools().map((tool) => tool.name);
    expect(names).toEqual(["account_status", "network_probe", "print_queue_status", "peripheral_list", "service_status"]);
  });

  it("maps every registered tool 1:1 onto a real policy entry (FR-013)", () => {
    expect(validateToolRegistry()).toEqual([]);
  });

  it("is addressable by name via the registry map", () => {
    const map = getToolRegistryMap();
    expect(map.get("account_status")?.policyEntryId).toBe("account-status");
    expect(map.get("unknown_tool")).toBeUndefined();
  });

  it("validates arguments against each tool's own schema, rejecting free text", () => {
    const map = getToolRegistryMap();
    const accountStatus = map.get("account_status");
    expect(accountStatus?.argumentSchema.safeParse({ username: "test-user-locked" }).success).toBe(true);
    expect(accountStatus?.argumentSchema.safeParse({ username: "root" }).success).toBe(false);
    expect(accountStatus?.argumentSchema.safeParse({ username: "anything; rm -rf /" }).success).toBe(false);
  });
});
