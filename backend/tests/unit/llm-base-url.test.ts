import { describe, expect, it } from "vitest";
import { isLocalBaseUrl } from "../../src/services/llm/openai-compat-provider.js";
import { envSchema } from "../../src/config/index.js";

describe("isLocalBaseUrl", () => {
  it("LP-001: treats loopback hosts as local so LLM_API_KEY stays optional", () => {
    expect(isLocalBaseUrl("http://127.0.0.1:1234/v1")).toBe(true);
    expect(isLocalBaseUrl("http://localhost:1234/v1")).toBe(true);
    expect(isLocalBaseUrl("http://[::1]:1234/v1")).toBe(true);
  });

  it("LP-002: treats host.docker.internal as local for containerised backends", () => {
    expect(isLocalBaseUrl("http://host.docker.internal:1234/v1")).toBe(true);
  });

  it("LP-003: requires a key for remote providers", () => {
    expect(isLocalBaseUrl("https://api.openai.com/v1")).toBe(false);
  });

  it("LP-004: matches the hostname exactly, so a lookalike domain stays remote", () => {
    expect(isLocalBaseUrl("http://localhost.example.com/v1")).toBe(false);
    expect(isLocalBaseUrl("http://127.0.0.1.example.com/v1")).toBe(false);
  });
});

// isLocalBaseUrl calls new URL() unguarded, which is only safe because the
// schema rejects anything that is not an absolute http(s) URL first.
describe("envSchema.LLM_BASE_URL", () => {
  function accepts(value: string | undefined): boolean {
    return envSchema.shape.LLM_BASE_URL.safeParse(value).success;
  }

  it("LP-005: accepts absolute http(s) URLs, including an IPv6 literal", () => {
    expect(accepts("http://127.0.0.1:1234/v1")).toBe(true);
    expect(accepts("http://[::1]:1234/v1")).toBe(true);
    expect(accepts("https://api.openai.com/v1")).toBe(true);
  });

  it("LP-006: accepts an unset value so the provider falls back to its default", () => {
    expect(accepts(undefined)).toBe(true);
  });

  it("LP-007: rejects a missing scheme rather than reporting it as a missing API key", () => {
    expect(accepts("127.0.0.1:1234/v1")).toBe(false);
    // Parses as protocol "localhost:" with an empty hostname, so .url() alone lets it through.
    expect(accepts("localhost:1234/v1")).toBe(false);
  });

  it("LP-008: rejects non-http schemes and free text", () => {
    expect(accepts("ftp://example.com/v1")).toBe(false);
    expect(accepts("not a url")).toBe(false);
  });
});
