import { EventEmitter } from "node:events";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { executeViaSsh, setClientFactoryForTest } from "../../src/services/remediation/executor.js";
import type { ExecutionRequest } from "../../src/services/remediation/policy-engine.js";
import { buildTestEndpoint } from "../helpers/factories.js";

// T032: the executor is exercised entirely against a stubbed SSH transport —
// no real network I/O, no real Docker containers. Every behaviour under test
// (timeouts, host-key pinning, command opacity) is a property of executor.ts
// itself, independent of ssh2's real protocol implementation.

class FakeStream extends EventEmitter {
  stderr = new EventEmitter();
  closed = false;
  close(): void {
    this.closed = true;
  }
}

class FakeClient extends EventEmitter {
  connectArgs: unknown;
  execCommand: string | undefined;
  destroyed = false;
  ended = false;
  stream = new FakeStream();

  connect(cfg: { hostVerifier?: (digest: string) => boolean }): void {
    this.connectArgs = cfg;
  }

  exec(command: string, cb: (err: Error | undefined, stream: FakeStream) => void): void {
    this.execCommand = command;
    cb(undefined, this.stream);
  }

  end(): void {
    this.ended = true;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function buildRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    endpoint: buildTestEndpoint({ hostKeyFingerprint: "abc123" }),
    command: "sudo /usr/local/bin/account-status.sh test-user-locked",
    timeoutMs: 50,
    ...overrides,
  };
}

let fakeClient: FakeClient;

beforeEach(() => {
  vi.useFakeTimers();
  fakeClient = new FakeClient();
  setClientFactoryForTest(() => fakeClient as unknown as import("ssh2").Client);
});

afterEach(() => {
  vi.useRealTimers();
  setClientFactoryForTest(undefined);
});

describe("executor.executeViaSsh", () => {
  it("passes the command to ssh2 verbatim, with no employee text or model output concatenated in", async () => {
    const request = buildRequest({ command: "sudo /usr/local/bin/account-status.sh test-user-locked" });
    const promise = executeViaSsh(request);

    fakeClient.emit("ready");
    fakeClient.stream.emit("close", 0);
    await promise;

    expect(fakeClient.execCommand).toBe("sudo /usr/local/bin/account-status.sh test-user-locked");
  });

  it("times out and force-closes the connection when the connect phase hangs", async () => {
    const request = buildRequest();
    const promise = executeViaSsh(request);

    await vi.advanceTimersByTimeAsync(5_001);
    const result = await promise;

    expect(result.outcome).toBe("timed_out");
    expect(fakeClient.destroyed).toBe(true);
  });

  it("times out and force-closes the channel and connection when the command hangs", async () => {
    const request = buildRequest({ timeoutMs: 100 });
    const promise = executeViaSsh(request);

    fakeClient.emit("ready");
    await vi.advanceTimersByTimeAsync(101);
    const result = await promise;

    expect(result.outcome).toBe("timed_out");
    expect(fakeClient.stream.closed).toBe(true);
    expect(fakeClient.destroyed).toBe(true);
  });

  it("rejects a connection whose host key does not match the pinned fingerprint", () => {
    const request = buildRequest();
    void executeViaSsh(request);

    const cfg = fakeClient.connectArgs as { hostVerifier: (digest: string) => boolean };
    expect(cfg.hostVerifier("a-different-digest")).toBe(false);
    expect(cfg.hostVerifier("abc123")).toBe(true);
  });

  it("reports a failed outcome on a non-zero exit code", async () => {
    const request = buildRequest();
    const promise = executeViaSsh(request);

    fakeClient.emit("ready");
    fakeClient.stream.emit("close", 1);
    const result = await promise;

    expect(result.outcome).toBe("failed");
  });

  it("reports a failed outcome when the connection itself errors", async () => {
    const request = buildRequest();
    const promise = executeViaSsh(request);

    fakeClient.emit("error", new Error("ECONNREFUSED"));
    const result = await promise;

    expect(result.outcome).toBe("failed");
  });
});
