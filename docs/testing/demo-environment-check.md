# Demo-Machine Environment Check

**Purpose**: Prove the demo machine matches the environment the phase's evidence claims
(NFR-7). A session run outside this contract is discarded, not scored
(contracts/session-record.md C8). Written for `specs/006-refining-transition` Phase 1
(Setup) and closed out at Phase 8 (T081).

**Machine**: HP Victus 16 (Ryzen 5 8645HS, 16 GB RAM, RTX 4050, Windows 11) — the single
designated demo machine (plan.md § Technical Context).

---

## T001 — MongoDB replica set `rs0`

**Date**: 2026-08-27

`mongosh` is not installed on this machine's PATH, so the replica set status was confirmed
via the Node MongoDB driver instead (equivalent check — `admin.command({ replSetGetStatus: 1
})` is exactly what `rs.status()` calls):

```
OK 1 set rs0 myState 1
```

`ok: 1`, `set: "rs0"`, `myState: 1` (PRIMARY). **Result: PASS.** The single-node replica set
required by `backend/.env`'s `MONGODB_URI=mongodb://127.0.0.1:27017/helpdesk?replicaSet=rs0`
is up and reachable — required for transactional steps (Excel import Apply) to work at all.

> Note for a future run: install `mongosh` on the demo machine so this check can use the
> documented `mongosh --eval "rs.status().ok"` command directly.

## T002 — LM Studio serving `qwen2.5-7b-instruct` over `openai_compat`

**Date**: 2026-08-27

`curl http://127.0.0.1:1234/v1/models`:

```json
{
  "data": [
    { "id": "qwen2.5-7b-instruct", "object": "model", "owned_by": "organization_owner" },
    { "id": "text-embedding-nomic-embed-text-v1.5", "object": "model", "owned_by": "organization_owner" }
  ],
  "object": "list"
}
```

Matches `backend/.env`: `LLM_PROVIDER=openai_compat`, `LLM_BASE_URL=http://127.0.0.1:1234/v1`,
`LLM_MODEL=qwen2.5-7b-instruct`. **Result: PASS.**

## T003 — Registered test endpoints reachable

**Date**: 2026-08-27

Endpoints from `backend/src/policy/test-endpoints.json`, checked with a raw TCP connect
(equivalent of a reachability probe):

| id | host:port | Result |
|---|---|---|
| `test-node-a` | 127.0.0.1:2201 | REACHABLE |
| `test-node-b` | 127.0.0.1:2202 | REACHABLE |

**Result: PASS.**

## T004 — Dependencies installed

**Date**: 2026-08-27

- `npm --prefix backend ci` — 478 packages added, 0 errors (12 pre-existing audit advisories,
  unrelated to this phase and out of scope under FR-016).
- `npm --prefix frontend ci` — 356 packages added, 0 errors (11 pre-existing audit advisories).

Environment: Node `v24.14.1`, npm `11.11.0`.

**Result: PASS.**

## T005 — Backend baseline gates

**Date**: 2026-08-27

| Gate | Result |
|---|---|
| `npm --prefix backend run typecheck` | **PASS** — clean, no errors |
| `npm --prefix backend run lint` | **PASS** — 0 errors, 1 pre-existing warning (`tests/unit/policy-schema.test.ts:46` unused `_drop`) |
| `npm --prefix backend test` (full suite, single run) | 75 files: **72 passed / 3 failed**; 419 tests: **412 passed / 4 failed / 3 skipped** |

**Full-suite failure detail**: `tests/integration/imports.test.ts`,
`tests/integration/remediation-verification.test.ts`, and
`tests/integration/remediation-endpoint-failure.test.ts` failed when the full 75-file suite
ran together — errors were `mongodb-memory-server` instance cleanup races
(`instance.mongodProcess is still defined`, `ECONNREFUSED` against an ephemeral port) and one
SSH `Deriving bits failed`. These three files each spin their own in-process
`MongoMemoryReplSet` independent of the external `rs0` used by the rest of the suite, and
contend for resources when ~75 files run in parallel.

**Isolation re-run** (same three files run alone, immediately after):

```
numTotalTestSuites 6 numPassedTestSuites 6 numFailedTestSuites 0
numTotalTests 12 numPassedTests 12 numFailedTests 0
```

All three pass cleanly in isolation. **Verdict: baseline is PASS, with a known
resource-contention flake under full-suite parallelism** — not a functional regression. This
is the pre-refinement baseline figure Phase 6 (T065) is compared against; a Phase 6 run
showing the same three files flake under the same conditions is not a new defect, but any
*different* file failing, or these three failing in isolation, is.

## T006 — Frontend baseline gates

**Date**: 2026-08-27

| Gate | Result |
|---|---|
| `npm --prefix frontend run typecheck` | **PASS** — clean, no errors |
| `npm --prefix frontend run lint` | **PASS** — clean, no warnings |
| `npm --prefix frontend test` | **PASS** — 27 files, 133 tests, all green |

**Result: PASS, fully green.**

---

## Phase 1 checkpoint

Environment contract verified: `rs0` is up, LM Studio is serving the correct model, both
registered test endpoints are reachable, dependencies are installed, and a pre-refinement
baseline is recorded (backend: 412/419 automated + 12/12 on isolation re-run; frontend:
133/133). A Phase 6 regression is now detectable against these numbers rather than a memory.

---

<!-- T023 (US1) and T081 (Polish) entries appended below in their own phases. -->
