# T007: resets the designated isolated test endpoints to a known state (FR-020).
# Single documented command for the release-gated demo path (SC-008, research.md R1).
#
# Usage: powershell -File backend/test-endpoints/reset.ps1
#
# What this does:
#   1. Generates the remediation SSH client keypair once (backend/.keys/), if missing.
#   2. Stages the client's public key as each endpoint's authorized_keys (gitignored,
#      regenerated build input — never commit these).
#   3. `docker compose down -v` then `up -d --build`, so account/service/print-queue
#      state resets to the images' baked-in baseline and each container gets a fresh
#      SSH host key.
#   4. Captures the fresh host key fingerprints into the endpoint registry
#      (capture-host-keys.mjs), so pinning always matches what's actually running.

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$keysDir = Join-Path $backendDir ".keys"
$clientKeyPath = Join-Path $keysDir "remediation_id_ed25519"

if (-not (Test-Path $keysDir)) {
    New-Item -ItemType Directory -Path $keysDir | Out-Null
}

if (-not (Test-Path $clientKeyPath)) {
    Write-Host "Generating remediation SSH client keypair..."
    ssh-keygen -t ed25519 -N '""' -C "remediation-client" -f $clientKeyPath | Out-Null
}
else {
    Write-Host "Reusing existing remediation SSH client keypair."
}

$publicKey = Get-Content "$clientKeyPath.pub" -Raw

foreach ($node in @("node-a", "node-b")) {
    $authorizedKeysPath = Join-Path $scriptDir "$node\authorized_keys"
    Set-Content -Path $authorizedKeysPath -Value $publicKey -NoNewline
}

Write-Host "Resetting test endpoint containers..."
Push-Location $scriptDir
try {
    docker compose down -v
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed with exit code $LASTEXITCODE"
    }

    Write-Host "Waiting for sshd to accept connections..."
    Start-Sleep -Seconds 3

    Write-Host "Capturing host key fingerprints into the endpoint registry..."
    node "$scriptDir\capture-host-keys.mjs"
}
finally {
    Pop-Location
}

Write-Host "Test endpoints reset. test-node-a on 127.0.0.1:2201, test-node-b on 127.0.0.1:2202."
Write-Host "Set REMEDIATION_SSH_KEY_PATH=$clientKeyPath in your .env to use this keypair."
