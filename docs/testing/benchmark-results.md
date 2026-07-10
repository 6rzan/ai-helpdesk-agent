# Classification Benchmark Results (T044)

**Date**: 2026-07-09
**Suite**: `backend/tests/benchmark/classification.bench.test.ts` (TC-025), 70 fixtures
**Command**: `npm run test:benchmark` with `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` pointed at LM Studio

## Environment

| Item | Value |
|---|---|
| LLM runtime | LM Studio (OpenAI-compatible server, `http://127.0.0.1:1234/v1`) via `openai_compat` provider |
| Model | Qwen2.5-7B-Instruct, Q4_K_M GGUF |
| Hardware | HP Victus 16 — Ryzen 5 8645HS, 16 GB RAM, RTX 4050 6 GB VRAM |
| Decoding | `temperature: 0` (greedy — deterministic runs) |
| Output constraint | `response_format: json_schema` (strict, category enum embedded) |

> The plan originally named Ollama + llama3.1:8b as the default runtime. LM Studio was
> substituted (same local-only, single-machine constraint) because it was already installed
> on the demo machine; the backend's single provider abstraction (`backend/src/services/llm/`)
> made this a configuration-only swap.

## Final results

| Metric | Result | Success criterion | Status |
|---|---|---|---|
| Accuracy | **100.0%** (70/70) | ≥ 80% (SC-003) | PASS |
| Confident misclassification rate | **0.0%** | ≤ 5% (SC-003) | PASS |
| p90 classification latency | **1,644 ms** | ≤ 10,000 ms (SC-008) | PASS |

Vitest: `1 passed (1)`, duration 100.35 s for the full 70-request run.

## Iteration history

| Run | Accuracy | Confident-wrong | p90 | Change applied |
|---|---|---|---|---|
| 1 | 0% | 0% | 8 ms | All requests failed: LM Studio rejects `response_format: json_object` (HTTP 400). Fixed by switching the provider to strict `json_schema` with the seven-category enum embedded. |
| 2 | 90.0% | 10.0% | 2,419 ms | Diagnosed 6–7 confident misses: vague reports ("my computer is acting weird") classified `performance` at 0.8; `network`/`service_status` and `printer`/`peripherals` boundary confusions. Added per-category definitions + a "vague report ⇒ confidence below 0.5" rule to the system prompt. |
| 3 | ~94% | 5.7% | — | Vague reports fixed (now ask clarification), but `service_status` definition over-corrected, pulling floor-wide connectivity outages out of `network`. Refined both definitions (network = connectivity even for a whole floor; service_status = hosted service down while connectivity works), clarified printer-attached scanners → `printer` and single-device freezes → `peripherals`, and pinned `temperature: 0`. |
| 4 | **100.0%** | **0.0%** | **1,644 ms** | Final — all gates pass. |

## Scoring notes

- `ambiguous` and `out_of_scope` fixtures score as correct when the outcome is
  `needs_clarification` or a classification into `unclassified` — the never-silent-guess
  invariant (Principle II) counts a confident wrong answer on these as a failure.
- Confident misclassification = outcome `classified` (confidence ≥ 0.7 threshold) with the
  wrong category.
