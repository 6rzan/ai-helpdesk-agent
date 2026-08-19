import { readFileSync } from "node:fs";
import { Client } from "ssh2";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import type { ExecutionRequest, ExecutionResult } from "./policy-engine.js";

// R2/R9: the only module that opens an SSH connection. Host, port, and user are
// structured parameters passed straight to ssh2 — there is no command line to
// assemble, so there is no place for an injected host to appear. Host keys are
// pinned via `hostVerifier` + `hostHash: "sha256"`, which makes ssh2 hash the raw
// key blob itself and hand this callback the lowercase hex digest — the exact
// value `test-endpoints/capture-host-keys.mjs` computed at setup (verified against
// ssh2's own source, not assumed).

const MAX_OUTPUT_LENGTH = 8_000;

function truncate(output: string): string {
  return output.length > MAX_OUTPUT_LENGTH ? `${output.slice(0, MAX_OUTPUT_LENGTH)}\n...[truncated]` : output;
}

export type ClientFactory = () => Client;

let clientFactory: ClientFactory = () => new Client();

/** Test-only: inject a stubbed SSH transport instead of a real ssh2.Client. */
export function setClientFactoryForTest(factory: ClientFactory | undefined): void {
  clientFactory = factory ?? (() => new Client());
}

/**
 * Runs one already-matched, already-authorised command over SSH against a
 * registered endpoint. Called only from policy-engine.ts (FR-002, FR-006) —
 * nothing here decides *whether* to run; it only runs what it is given.
 */
export function executeViaSsh(request: ExecutionRequest): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const client = clientFactory();

  return new Promise<ExecutionResult>((resolve) => {
    let settled = false;
    let commandTimer: ReturnType<typeof setTimeout> | undefined;

    function finish(result: ExecutionResult): void {
      if (settled) {
        return;
      }
      settled = true;
      if (commandTimer) {
        clearTimeout(commandTimer);
      }
      try {
        client.end();
      } catch {
        // already closed/destroyed
      }
      resolve(result);
    }

    const connectTimer = setTimeout(() => {
      logger.warn({ endpointId: request.endpoint.id }, "ssh connect timed out");
      finish({ outcome: "timed_out", observedOutput: null, durationMs: Date.now() - startedAt });
      client.destroy();
    }, config.REMEDIATION_CONNECT_TIMEOUT_MS);

    client.on("error", (err: Error) => {
      clearTimeout(connectTimer);
      logger.warn({ err, endpointId: request.endpoint.id }, "ssh connection failed");
      finish({ outcome: "failed", observedOutput: null, durationMs: Date.now() - startedAt });
    });

    client.on("ready", () => {
      clearTimeout(connectTimer);

      client.exec(request.command, (err, stream) => {
        if (err) {
          logger.warn({ err, endpointId: request.endpoint.id }, "ssh exec failed to start");
          finish({ outcome: "failed", observedOutput: null, durationMs: Date.now() - startedAt });
          return;
        }

        let stdout = "";
        let stderr = "";

        commandTimer = setTimeout(() => {
          logger.warn({ endpointId: request.endpoint.id, command: request.command }, "ssh command timed out");
          finish({
            outcome: "timed_out",
            observedOutput: truncate((stdout + stderr).trim()),
            durationMs: Date.now() - startedAt,
          });
          try {
            stream.close();
          } catch {
            // already closed
          }
          client.destroy();
        }, request.timeoutMs);

        stream.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });
        stream.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
        stream.on("close", (code: number | null) => {
          finish({
            outcome: code === 0 ? "succeeded" : "failed",
            observedOutput: truncate((stdout + stderr).trim()),
            durationMs: Date.now() - startedAt,
          });
        });
      });
    });

    client.connect({
      host: request.endpoint.host,
      port: request.endpoint.port,
      username: request.endpoint.username,
      ...(config.REMEDIATION_SSH_KEY_PATH ? { privateKey: readFileSync(config.REMEDIATION_SSH_KEY_PATH) } : {}),
      ...(config.REMEDIATION_SSH_KEY_PASSPHRASE ? { passphrase: config.REMEDIATION_SSH_KEY_PASSPHRASE } : {}),
      readyTimeout: config.REMEDIATION_CONNECT_TIMEOUT_MS,
      hostHash: "sha256",
      hostVerifier: (digest: string): boolean => digest === request.endpoint.hostKeyFingerprint,
    });
  });
}
