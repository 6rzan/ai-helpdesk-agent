import { describe, expect, it } from "vitest";
import { envSchema } from "../../src/config/index.js";

// T002: new remediation and provider-chain configuration, defaults and boolean parsing.
describe("envSchema — remediation and provider-chain config", () => {
  function parse(overrides: Record<string, string> = {}) {
    const result = envSchema.safeParse({ ...process.env, ...overrides });
    if (!result.success) {
      throw new Error(result.error.message);
    }
    return result.data;
  }

  it("defaults LLM_PROVIDERS to undefined so the chain derives from LLM_PROVIDER", () => {
    const unset = envSchema.safeParse({ ...process.env, LLM_PROVIDERS: undefined });
    expect(unset.success).toBe(true);
    if (unset.success) {
      expect(unset.data.LLM_PROVIDERS).toBeUndefined();
    }
  });

  it("accepts an explicit LLM_PROVIDERS list", () => {
    const config = parse({ LLM_PROVIDERS: "ollama,openai_compat" });
    expect(config.LLM_PROVIDERS).toBe("ollama,openai_compat");
  });

  it("defaults AGENT_MAX_STEPS to 3", () => {
    const config = parse();
    expect(config.AGENT_MAX_STEPS).toBe(3);
  });

  it("defaults REMEDIATION_ENABLED to false when unset", () => {
    const config = parse();
    expect(config.REMEDIATION_ENABLED).toBe(false);
  });

  it("parses REMEDIATION_ENABLED=true as true", () => {
    const config = parse({ REMEDIATION_ENABLED: "true" });
    expect(config.REMEDIATION_ENABLED).toBe(true);
  });

  it("parses REMEDIATION_ENABLED=false as false, not truthy-string-coerced", () => {
    const config = parse({ REMEDIATION_ENABLED: "false" });
    expect(config.REMEDIATION_ENABLED).toBe(false);
  });

  it("defaults the remediation timeouts and approval TTL", () => {
    const config = parse();
    expect(config.REMEDIATION_CONNECT_TIMEOUT_MS).toBe(5_000);
    expect(config.REMEDIATION_COMMAND_TIMEOUT_MS).toBe(15_000);
    expect(config.REMEDIATION_APPROVAL_TTL_MINUTES).toBe(30);
  });

  it("leaves REMEDIATION_SSH_KEY_PATH and REMEDIATION_SSH_KEY_PASSPHRASE optional", () => {
    // Explicit undefined override, same pattern as the LLM_PROVIDERS test above:
    // the demo machine's own .env sets a real key path, so relying on ambient
    // process.env alone would assert against the developer's local secrets
    // rather than the schema's actual default.
    const unset = envSchema.safeParse({
      ...process.env,
      REMEDIATION_SSH_KEY_PATH: undefined,
      REMEDIATION_SSH_KEY_PASSPHRASE: undefined,
    });
    expect(unset.success).toBe(true);
    if (unset.success) {
      expect(unset.data.REMEDIATION_SSH_KEY_PATH).toBeUndefined();
      expect(unset.data.REMEDIATION_SSH_KEY_PASSPHRASE).toBeUndefined();
    }
  });
});
