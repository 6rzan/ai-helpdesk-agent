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

const KEYSCAN_ATTEMPTS = 5;
const KEYSCAN_RETRY_DELAY_MS = 1_500;

// The container's sshd (OpenSSH 9.2, Debian) offers the post-quantum hybrid
// KEX sntrup761x25519-sha512@openssh.com, which Windows' bundled
// C:\Windows\System32\OpenSSH\ssh-keyscan.exe (an older build) doesn't
// support and refuses outright ("choose_kex: unsupported KEX method ...").
// PowerShell's default PATH resolves that one ahead of Git for Windows' own
// ssh-keyscan (which does support it), so plain `ssh-keyscan` on PATH is not
// reliable when this script runs from reset.ps1. Try known-good candidates
// before falling back to whatever PATH resolves.
const KEYSCAN_CANDIDATES = ["C:\\Program Files\\Git\\usr\\bin\\ssh-keyscan.exe", "ssh-keyscan"];

function sleepSync(ms) {
  const target = Date.now() + ms;
  while (Date.now() < target) {
    // A container that just started (esp. right after `--build`) can take a
    // moment before sshd is ready to complete key exchange; ssh-keyscan then
    // fails outright rather than waiting. Busy-wait rather than pull in an
    // async runtime here — this script is a short-lived one-shot CLI.
  }
}

function scanOnce(host, port) {
  let lastError;
  for (const bin of KEYSCAN_CANDIDATES) {
    try {
      // ssh-keyscan prints "host key-type base64blob" lines (comments start with '#').
      const output = execFileSync(bin, ["-p", String(port), "-t", "ed25519", host], {
        encoding: "utf8",
        timeout: 10_000,
      });
      const line = output.split("\n").find((l) => l.trim() && !l.startsWith("#"));
      if (line) {
        return line;
      }
      lastError = new Error(`No host key returned for ${host}:${port} (via ${bin})`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error(`No host key returned for ${host}:${port}`);
}

function fingerprintFor(host, port) {
  let lastError;
  for (let attempt = 1; attempt <= KEYSCAN_ATTEMPTS; attempt++) {
    try {
      const line = scanOnce(host, port);
      const parts = line.trim().split(/\s+/);
      const base64Blob = parts[parts.length - 1];
      const rawBlob = Buffer.from(base64Blob, "base64");
      return createHash("sha256").update(rawBlob).digest("hex");
    } catch (err) {
      lastError = err;
      if (attempt < KEYSCAN_ATTEMPTS) {
        sleepSync(KEYSCAN_RETRY_DELAY_MS);
      }
    }
  }
  throw new Error(
    `No host key returned for ${host}:${port} after ${KEYSCAN_ATTEMPTS} attempts — is the container running? (${lastError?.message})`,
  );
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
