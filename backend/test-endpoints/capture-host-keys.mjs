#!/usr/bin/env node
// T006: reads each running endpoint's SSH host key and pins its fingerprint
// into the endpoint registry (backend/src/policy/test-endpoints.json).
//
// Host keys regenerate every container start (research.md R1/R2), so this is
// meant to run once per `reset.ps1` cycle, after `docker compose up -d`.
//
// The fingerprint format here MUST match what the executor's ssh2 hostVerifier
// computes: hostHash: "sha256" makes ssh2 hash the raw host key blob and hand
// hostVerifier a lowercase hex SHA-256 digest (see ssh2/lib/client.js). This
// script reproduces that exact computation from `ssh-keyscan` output so the
// two never drift apart.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.resolve(__dirname, "../src/policy/test-endpoints.json");

const endpoints = [
  { id: "test-node-a", host: "127.0.0.1", port: 2201 },
  { id: "test-node-b", host: "127.0.0.1", port: 2202 },
];

function fingerprintFor(host, port) {
  // ssh-keyscan prints "host key-type base64blob" lines (comments start with '#').
  const output = execFileSync("ssh-keyscan", ["-p", String(port), "-t", "ed25519", host], {
    encoding: "utf8",
    timeout: 10_000,
  });
  const line = output.split("\n").find((l) => l.trim() && !l.startsWith("#"));
  if (!line) {
    throw new Error(`No host key returned for ${host}:${port} — is the container running?`);
  }
  const parts = line.trim().split(/\s+/);
  const base64Blob = parts[parts.length - 1];
  const rawBlob = Buffer.from(base64Blob, "base64");
  return createHash("sha256").update(rawBlob).digest("hex");
}

function main() {
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  for (const endpoint of endpoints) {
    const fingerprint = fingerprintFor(endpoint.host, endpoint.port);
    const entry = registry.entries.find((e) => e.id === endpoint.id);
    if (!entry) {
      console.warn(`No registry entry for ${endpoint.id}; skipping`);
      continue;
    }
    entry.hostKeyFingerprint = fingerprint;
    console.log(`${endpoint.id}: ${fingerprint}`);
  }
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`Updated ${registryPath}`);
}

main();
