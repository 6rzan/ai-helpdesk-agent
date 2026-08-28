<#
.SYNOPSIS
  Brings the demo stack up and resumes the 24-hour availability probe window.

.DESCRIPTION
  006 T086 asked for "resume-from-log support (or an equivalent supervised
  restart)". The resume half lives in availability-probe.ts; this is the
  supervisor half, so a reboot no longer needs a human at the keyboard.

  Three windows were destroyed by reboots before this existed. The naive fix --
  a scheduled task that runs the probe at logon -- is worse than nothing:
  probeOnce() records an *unreachable* row as a Failed attempt, so firing the
  probe while MongoDB or the backend is still starting burns real attempts and
  makes main() exit non-zero. SC-006 would then read as a failure caused purely
  by a logon race. So this script refuses to start the probe until
  /api/health actually answers, and gives up rather than probing a dead stack.

  Safe to run repeatedly: it starts only what is not already up, exits if a
  probe is already running, and exits if the window has already closed.
#>
[CmdletBinding()]
param(
  # Bounded so a wedged dependency fails loudly instead of hanging the task.
  [int] $StackTimeoutSeconds = 300
)

$ErrorActionPreference = 'Stop'

$RepoRoot    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackendDir  = Join-Path $RepoRoot 'backend'
$ProbeLog    = Join-Path $RepoRoot 'docs\testing\availability-probe-24h.log'
# Runtime noise, not evidence: the .log table is the artifact. Start-Process
# redirection TRUNCATES its target, so the probe's streams must never share a
# file with the supervisor's own append-only trace. .gitignore excludes the dir.
$RuntimeDir  = Join-Path $RepoRoot 'docs\testing\.probe-runtime'
$TraceLog    = Join-Path $RuntimeDir 'supervisor.log'
$ProbeOut    = Join-Path $RuntimeDir 'probe-stdout.log'
$ProbeErr    = Join-Path $RuntimeDir 'probe-stderr.log'
# Machine-local runtime state, deliberately outside the repo so it is never committed.
$PidFile     = Join-Path $env:TEMP 'helpdesk-availability-probe.pid'
$MongoName   = 'helpdesk-mongo'
$LlmModel    = 'qwen2.5-7b-instruct'
$HealthUrl   = 'http://127.0.0.1:3000/api/health'

function Write-Trace {
  param([string] $Message)
  $line = "[{0}] {1}" -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'), $Message
  Write-Host $line
  Add-Content -Path $TraceLog -Value $line -Encoding utf8
}

function Wait-For {
  param([scriptblock] $Condition, [string] $What, [int] $TimeoutSeconds)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try { if (& $Condition) { Write-Trace "ready: $What"; return $true } } catch { }
    Start-Sleep -Seconds 3
  }
  Write-Trace "TIMEOUT waiting for $What (${TimeoutSeconds}s)"
  return $false
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Write-Trace '--- probe-supervisor starting ---'

# --- Guard 1: single instance, enforced by kernel objects ---------------------
# A Win32_Process CommandLine scan was tried first and FAILED OPEN under Task
# Scheduler's non-elevated context: it could not read the command lines, matched
# nothing, and started a SECOND probe against the same log (both would have
# written attempt 3). Duplicate rows are worse than a missed window, so the guard
# now fails closed. A mutex is visible regardless of how the caller was launched;
# the PID file additionally catches a probe started outside this supervisor.
$mutexName = 'HelpdeskAvailabilityProbeSupervisor'
$mutex = $null
$holdsLock = $false
try {
  $mutex = New-Object System.Threading.Mutex($false, $mutexName)
  try { $holdsLock = $mutex.WaitOne(0) }
  catch [System.Threading.AbandonedMutexException] { $holdsLock = $true }  # previous holder died
} catch {
  Write-Trace "could not create mutex ($($_.Exception.Message)) - falling back to the PID file alone"
  $holdsLock = $true
}
if (-not $holdsLock) {
  Write-Trace 'another supervisor holds the probe lock - nothing to do'
  exit 0
}

if (Test-Path $PidFile) {
  $recorded = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  $alive = $null
  if ($recorded -match '^\d+$') { $alive = Get-Process -Id ([int] $recorded) -ErrorAction SilentlyContinue }
  if ($alive) {
    Write-Trace "probe already running (PID $recorded) - nothing to do"
    if ($mutex) { $mutex.ReleaseMutex(); $mutex.Dispose() }
    exit 0
  }
  Write-Trace "clearing stale PID file (PID $recorded is gone)"
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# --- Guard 2: a closed window must not be reopened ----------------------------
if ((Test-Path $ProbeLog) -and (Select-String -Path $ProbeLog -Pattern '^\*\*Summary\*\*' -Quiet)) {
  Write-Trace 'window already closed (log carries its summary) - nothing to do'
  exit 0
}

# --- Docker Desktop + MongoDB replica set -------------------------------------
if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
  $dd = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dd) { Write-Trace 'starting Docker Desktop'; Start-Process $dd } 
  else { Write-Trace "Docker Desktop not found at $dd" }
}
if (-not (Wait-For { docker info 2>$null | Out-Null; $LASTEXITCODE -eq 0 } 'docker daemon' $StackTimeoutSeconds)) { exit 1 }

if (-not (docker ps --filter "name=$MongoName" --format '{{.Names}}')) {
  Write-Trace "starting container $MongoName"
  docker start $MongoName | Out-Null
}
if (-not (Wait-For { (docker exec $MongoName mongosh --quiet --eval 'db.hello().isWritablePrimary' 2>$null) -match 'true' } 'mongodb rs0 primary' $StackTimeoutSeconds)) { exit 1 }

# --- LM Studio ----------------------------------------------------------------
$lms = Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'
if (Test-Path $lms) {
  Write-Trace 'starting LM Studio server'
  & $lms server start 2>&1 | Out-Null
  if (-not ((& $lms ps 2>&1) -match [regex]::Escape($LlmModel))) {
    Write-Trace "loading $LlmModel"
    & $lms load $LlmModel -y 2>&1 | Out-Null
  }
} else {
  Write-Trace "lms.exe not found at $lms - leaving the LLM to whatever is already serving"
}

# --- Backend ------------------------------------------------------------------
$backendUp = $null -ne (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
if (-not $backendUp) {
  Write-Trace 'starting backend dev server'
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory $BackendDir -WindowStyle Hidden
}

# The probe must not start until health actually answers, or it records
# unreachable rows as Failed attempts and corrupts the window.
if (-not (Wait-For { (Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5).status -eq 'ok' } 'backend /api/health ok' $StackTimeoutSeconds)) {
  Write-Trace 'stack never became healthy - refusing to probe (a Failed row here would be a lie about availability)'
  exit 1
}

# --- Resume the window --------------------------------------------------------
Write-Trace 'stack healthy - resuming probe window'
$env:PROBE_OUTPUT_PATH = $ProbeLog
Push-Location $BackendDir
try {
  $probe = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','availability-probe' `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $ProbeOut -RedirectStandardError $ProbeErr
  Set-Content -Path $PidFile -Value $probe.Id -Encoding ascii
  Write-Trace "probe started (PID $($probe.Id)); window resumes from the log"
  $probe.WaitForExit()
  Write-Trace "--- probe exited (code $($probe.ExitCode)) ---"
} finally {
  Pop-Location
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  if ($mutex) { $mutex.ReleaseMutex(); $mutex.Dispose() }
}
