import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadPolicyFromDisk } from "../../src/policy/policy-loader.js";

// T016: fail-closed loader behaviour (edge case, FR-002, FR-005). A missing,
// empty, or invalid policy file must leave remediation unavailable — never
// permissive — and must never throw past the loader into startup.
function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "policy-loader-test-"));
}

const VALID_ENDPOINT = {
  id: "test-node-a",
  label: "Test Node A",
  host: "127.0.0.1",
  port: 2201,
  username: "remediation",
  hostKeyFingerprint: "abc123",
  description: "General node",
};

const VALID_ENTRY = {
  id: "account-status",
  description: "Checks account status",
  category: "password_login",
  guidedStepRef: null,
  tier: "read_only",
  command: "sudo /usr/local/bin/account-status.sh {{username}}",
  arguments: [{ name: "username", kind: "enum", values: ["test-user-locked"] }],
  allowedEndpointIds: ["test-node-a"],
  verifiedBy: null,
  timeoutMs: null,
};

describe("loadPolicyFromDisk — fail-closed", () => {
  let dir: string;

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is unavailable when the policy file is missing", () => {
    dir = tempDir();
    const registryPath = path.join(dir, "test-endpoints.json");
    writeFileSync(registryPath, JSON.stringify({ entries: [VALID_ENDPOINT] }));
    const policyPath = path.join(dir, "does-not-exist.json");

    const result = loadPolicyFromDisk(policyPath, registryPath);
    expect(result.available).toBe(false);
    expect(result.policy).toBeNull();
    expect(result.entries.size).toBe(0);
  });

  it("is unavailable when the policy file has an empty entry list", () => {
    dir = tempDir();
    const policyPath = path.join(dir, "action-policy.json");
    const registryPath = path.join(dir, "test-endpoints.json");
    writeFileSync(policyPath, JSON.stringify({ version: "1.0.0", entries: [] }));
    writeFileSync(registryPath, JSON.stringify({ entries: [VALID_ENDPOINT] }));

    const result = loadPolicyFromDisk(policyPath, registryPath);
    expect(result.available).toBe(false);
    expect(result.policy).toBeNull();
  });

  it("is unavailable when the policy file fails schema validation", () => {
    dir = tempDir();
    const policyPath = path.join(dir, "action-policy.json");
    const registryPath = path.join(dir, "test-endpoints.json");
    writeFileSync(policyPath, JSON.stringify({ version: "1.0.0", entries: [{ id: "bad" }] }));
    writeFileSync(registryPath, JSON.stringify({ entries: [VALID_ENDPOINT] }));

    const result = loadPolicyFromDisk(policyPath, registryPath);
    expect(result.available).toBe(false);
    expect(result.policy).toBeNull();
  });

  it("is unavailable when the policy file is not valid JSON", () => {
    dir = tempDir();
    const policyPath = path.join(dir, "action-policy.json");
    const registryPath = path.join(dir, "test-endpoints.json");
    writeFileSync(policyPath, "{ not json");
    writeFileSync(registryPath, JSON.stringify({ entries: [VALID_ENDPOINT] }));

    const result = loadPolicyFromDisk(policyPath, registryPath);
    expect(result.available).toBe(false);
  });

  it("is unavailable when a policy entry names an unregistered endpoint", () => {
    dir = tempDir();
    const policyPath = path.join(dir, "action-policy.json");
    const registryPath = path.join(dir, "test-endpoints.json");
    writeFileSync(
      policyPath,
      JSON.stringify({ version: "1.0.0", entries: [{ ...VALID_ENTRY, allowedEndpointIds: ["nonexistent"] }] }),
    );
    writeFileSync(registryPath, JSON.stringify({ entries: [VALID_ENDPOINT] }));

    const result = loadPolicyFromDisk(policyPath, registryPath);
    expect(result.available).toBe(false);
  });

  it("is available with frozen, indexed data when both files are valid", () => {
    dir = tempDir();
    const policyPath = path.join(dir, "action-policy.json");
    const registryPath = path.join(dir, "test-endpoints.json");
    writeFileSync(policyPath, JSON.stringify({ version: "1.0.0", entries: [VALID_ENTRY] }));
    writeFileSync(registryPath, JSON.stringify({ entries: [VALID_ENDPOINT] }));

    const result = loadPolicyFromDisk(policyPath, registryPath);
    expect(result.available).toBe(true);
    expect(result.entries.get("account-status")?.id).toBe("account-status");
    expect(result.endpoints.get("test-node-a")?.id).toBe("test-node-a");
    expect(Object.isFrozen(result.policy)).toBe(true);
    expect(Object.isFrozen(result.registry)).toBe(true);
  });
});
