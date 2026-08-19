import { describe, expect, it } from "vitest";
import {
  actionPolicyEntrySchema,
  actionPolicyFileSchema,
  endpointRegistryFileSchema,
  testEndpointSchema,
  validatePolicyAgainstRegistry,
} from "../../src/policy/policy-schema.js";

// T012: failing-first tests for the policy and registry schemas (data-model.md §1, §2).
function endpoint(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "test-node-a",
    label: "Test Node A",
    host: "127.0.0.1",
    port: 2201,
    username: "remediation",
    hostKeyFingerprint: "abc123",
    description: "General service node",
    ...overrides,
  };
}

function entry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "account-status",
    description: "Checks whether a local test account is locked",
    category: "password_login",
    guidedStepRef: null,
    tier: "read_only",
    command: "sudo /usr/local/bin/account-status.sh {{username}}",
    arguments: [{ name: "username", kind: "enum", values: ["test-user-locked", "test-user-active"] }],
    allowedEndpointIds: ["test-node-a"],
    verifiedBy: null,
    timeoutMs: null,
    ...overrides,
  };
}

describe("testEndpointSchema", () => {
  it("accepts a well-formed endpoint", () => {
    expect(testEndpointSchema.safeParse(endpoint()).success).toBe(true);
  });

  it("rejects a missing hostKeyFingerprint", () => {
    const { hostKeyFingerprint: _drop, ...rest } = endpoint();
    expect(testEndpointSchema.safeParse(rest).success).toBe(false);
  });
});

describe("endpointRegistryFileSchema — unique ids", () => {
  it("rejects duplicate endpoint ids", () => {
    const result = endpointRegistryFileSchema.safeParse({
      entries: [endpoint(), endpoint()],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a registry with unique ids", () => {
    const result = endpointRegistryFileSchema.safeParse({
      entries: [endpoint(), endpoint({ id: "test-node-b", label: "Test Node B" })],
    });
    expect(result.success).toBe(true);
  });
});

describe("actionPolicyEntrySchema — placeholder/argument symmetry", () => {
  it("accepts an entry whose placeholders and arguments match exactly", () => {
    expect(actionPolicyEntrySchema.safeParse(entry()).success).toBe(true);
  });

  it("rejects a command placeholder with no matching ArgumentSpec", () => {
    const result = actionPolicyEntrySchema.safeParse(
      entry({ command: "sudo /usr/local/bin/account-status.sh {{username}} {{extra}}" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an ArgumentSpec with no matching command placeholder", () => {
    const result = actionPolicyEntrySchema.safeParse(
      entry({
        arguments: [
          { name: "username", kind: "enum", values: ["test-user-locked"] },
          { name: "unused", kind: "enum", values: ["x"] },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a free-text argument kind", () => {
    const result = actionPolicyEntrySchema.safeParse(
      entry({ arguments: [{ name: "username", kind: "freetext" }] }),
    );
    expect(result.success).toBe(false);
  });

  it("requires an anchored pattern when kind is pattern", () => {
    const result = actionPolicyEntrySchema.safeParse(
      entry({
        command: "/usr/local/bin/network-probe.sh {{target}}",
        arguments: [{ name: "target", kind: "pattern" }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("requires a non-empty values list when kind is enum", () => {
    const result = actionPolicyEntrySchema.safeParse(
      entry({ arguments: [{ name: "username", kind: "enum", values: [] }] }),
    );
    expect(result.success).toBe(false);
  });
});

describe("actionPolicyFileSchema — file-level rules", () => {
  it("rejects duplicate policy entry ids", () => {
    const result = actionPolicyFileSchema.safeParse({
      version: "1.0.0",
      entries: [entry(), entry({ command: "sudo /usr/local/bin/account-status.sh {{username}}" })],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a state_changing entry whose verifiedBy names a real read_only entry", () => {
    const result = actionPolicyFileSchema.safeParse({
      version: "1.0.0",
      entries: [
        entry(),
        entry({
          id: "unlock-account",
          tier: "state_changing",
          command: "sudo /usr/local/bin/unlock-account.sh {{username}}",
          verifiedBy: "account-status",
        }),
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a state_changing entry whose verifiedBy names a nonexistent entry", () => {
    const result = actionPolicyFileSchema.safeParse({
      version: "1.0.0",
      entries: [
        entry({
          id: "unlock-account",
          tier: "state_changing",
          command: "sudo /usr/local/bin/unlock-account.sh {{username}}",
          verifiedBy: "does-not-exist",
        }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a state_changing entry whose verifiedBy names a state_changing entry", () => {
    const result = actionPolicyFileSchema.safeParse({
      version: "1.0.0",
      entries: [
        entry({
          id: "unlock-account",
          tier: "state_changing",
          command: "sudo /usr/local/bin/unlock-account.sh {{username}}",
          verifiedBy: "restart-service",
        }),
        entry({
          id: "restart-service",
          tier: "state_changing",
          command: "sudo /usr/local/bin/restart-service.sh {{username}}",
          verifiedBy: null,
        }),
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("validatePolicyAgainstRegistry — allowedEndpointIds must resolve", () => {
  it("passes when every allowedEndpointIds value exists in the registry", () => {
    const policy = actionPolicyFileSchema.parse({ version: "1.0.0", entries: [entry()] });
    const registry = endpointRegistryFileSchema.parse({ entries: [endpoint()] });
    expect(validatePolicyAgainstRegistry(policy, registry)).toEqual([]);
  });

  it("fails when an allowedEndpointIds value has no matching registry entry", () => {
    const policy = actionPolicyFileSchema.parse({
      version: "1.0.0",
      entries: [entry({ allowedEndpointIds: ["test-node-z"] })],
    });
    const registry = endpointRegistryFileSchema.parse({ entries: [endpoint()] });
    const issues = validatePolicyAgainstRegistry(policy, registry);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/test-node-z/);
  });
});
