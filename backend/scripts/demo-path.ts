/**
 * Release-gated demo path (research.md Decision 1, T007).
 *
 * A single re-runnable script that drives the real stack -- the demo
 * machine's `rs0` replica set, LM Studio, and the registered SSH test
 * endpoints -- through all seven legs FR-002/SC-008 require, in one
 * continuous run with no restart and no hand-edited data between stages:
 *
 *   1. intake                  -- a voice report reaches the agent
 *   2. classification          -- the report lands in a real category
 *   3. ticket-creation         -- a ticket exists for that category
 *   4. guided-troubleshooting  -- the guide's own steps are followed
 *   5. escalation              -- a case reaches a human
 *   6. staff-takeover          -- staff claims the escalated ticket
 *   7. whitelisted-remediation -- a state-changing action runs against a
 *                                 registered test endpoint, gated on
 *                                 explicit reporter consent AND staff
 *                                 approval
 *
 * It writes a timestamped PASS/FAIL log per leg to
 * `docs/testing/demo-path-runs/`, and exits non-zero if any leg failed or
 * was never reached, so `npm --prefix backend run demo-path` is a hard gate
 * (FR-002): tester sessions do not begin on a non-zero exit.
 *
 * The printer leg (4, 7) and the peripherals leg (5, 6) are two separate
 * conversations run back to back in the same process, exactly as the
 * superseded hand-driven log (`docs/testing/demo-path-log.md`) covered its
 * password and vague-report cases separately -- guided-to-remediation and
 * guided-to-escalation are alternate endings of the same flow, not two
 * points on one ticket's timeline.
 */

import { readFile, appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { allLegsPassed, buildLog, LEG_ORDER, type LegId, type LegResult } from "./demo-path/legs.js";
import {
  authenticateEmployee,
  authenticateStaff,
  BASE_URL,
  createSession,
  ensureStaffAccount,
  getTicketDetail,
  postMessage,
  snapshotTicketReferences,
  SseListener,
  type TicketSummary,
  waitFor,
  waitForNewTicket,
} from "./demo-path/client.js";

// T009's unit test imports these from this module; T082 moved their definitions
// into ./demo-path/legs.ts to bring this file under the 500-line limit, so they
// are re-exported here and that test's import path stays unchanged.
export { allLegsPassed, buildLog, LEG_ORDER };
export type { LegId, LegResult };

const VOICE_SAMPLE_PATH = process.env.DEMO_PATH_VOICE_SAMPLE
  ? path.resolve(process.env.DEMO_PATH_VOICE_SAMPLE)
  : path.resolve("scripts/fixtures/demo-voice-sample.wav");
const OUTPUT_DIR = process.env.DEMO_PATH_OUTPUT_DIR
  ? path.resolve(process.env.DEMO_PATH_OUTPUT_DIR)
  : path.resolve("../docs/testing/demo-path-runs/");
// The fixture reports (this WAV's transcript, and the escalation leg's fixed
// text) are identical on every run, so a re-run that leaves a still-open
// ticket behind (a crash, or a genuine FAIL, on an earlier attempt) gets met
// with a possible-duplicate check (conversation-engine.ts) instead of a new
// ticket -- correct product behaviour, but it means a leg can't unconditionally
// assume the next thing to happen after filing a report is ticket creation.
// Listens for the actual agent reply over SSE and answers the duplicate
// check if (and only if) it was actually asked, so the leg still ends up
// with a genuinely new ticket either way.
async function postReportAndClearDuplicateCheck(
  session: { sessionId: string; conversationId: string },
  text: string,
  inputOrigin: "typed" | "voice" = "typed",
): Promise<void> {
  const listener = await SseListener.open(session.sessionId);
  try {
    await postMessage(session.conversationId, session.sessionId, text, inputOrigin);
    const firstReply = (await listener.waitFor("agent_message", 20_000)) as { message: { text: string } };
    if (firstReply.message.text.includes("same problem, or something new")) {
      // Must not match DUPLICATE_SAME_PATTERN (conversation-engine.ts) -- no
      // "yes/same problem/issue/thing/it is" -- or the existing ticket is kept
      // and no new one is filed, which is the one outcome this can't recover from.
      await postMessage(session.conversationId, session.sessionId, "No, this is a different, new report.");
    }
  } finally {
    listener.close();
  }
}

// --- leg implementations ---

async function runIntakeThroughGuidance(cookie: string): Promise<{
  intake: LegResult;
  classification: LegResult;
  ticketCreation: LegResult;
  guidedTroubleshooting: LegResult;
  remediation: LegResult;
}> {
  const session = await createSession(cookie);
  const priorTicketRefs = await snapshotTicketReferences(session.sessionId);
  const audio = await readFile(VOICE_SAMPLE_PATH);
  const form = new FormData();
  form.append("audio", new Blob([audio], { type: "audio/wav" }), "demo-voice-sample.wav");

  const transcribeRes = await fetch(`${BASE_URL}/api/sessions/${session.sessionId}/transcriptions`, {
    method: "POST",
    body: form,
  });
  if (transcribeRes.status !== 200) {
    const detail = `transcription endpoint returned ${transcribeRes.status}`;
    const fail = (leg: LegId): LegResult => ({ leg, status: "FAIL", detail });
    return {
      intake: fail("intake"),
      classification: fail("classification"),
      ticketCreation: fail("ticket-creation"),
      guidedTroubleshooting: fail("guided-troubleshooting"),
      remediation: fail("whitelisted-remediation"),
    };
  }
  const { transcript } = (await transcribeRes.json()) as { transcript: string };
  await postReportAndClearDuplicateCheck(session, transcript, "voice");
  const intake: LegResult = { leg: "intake", status: "PASS", detail: `transcribed "${transcript}" and submitted via voice input` };

  const ticket = await waitForNewTicket(session.sessionId, priorTicketRefs, 15_000);
  const classification: LegResult = ticket.category
    ? { leg: "classification", status: "PASS", detail: `classified as "${ticket.category}"` }
    : { leg: "classification", status: "FAIL", detail: "ticket created with no category" };
  const ticketCreation: LegResult = { leg: "ticket-creation", status: "PASS", detail: `ticket ${ticket.reference} created` };

  // Advance one guided step so a state-changing action becomes eligible
  // (printer's clear-print-queue sits at guidedStepRef "printer:1"). Must not
  // name the category (conversation-guidance.ts's tryHandleGuidedReply reads
  // any category keyword -- "printer", "jammed", etc. -- as a fresh problem
  // report and bails out to duplicate-detection instead of advancing the
  // step); "still not working" is one of that function's own documented
  // safe examples of a plain step-outcome reply.
  await postMessage(session.conversationId, session.sessionId, "that didn't fix it, still not working");

  let guidedTroubleshooting: LegResult;
  let remediation: LegResult;
  try {
    const detail = await waitFor(async () => {
      const d = await getTicketDetail(ticket.reference, session.sessionId);
      return d.guidance && d.guidance.stepAttempts.length >= 1 ? d : null;
    }, 15_000);
    guidedTroubleshooting = {
      leg: "guided-troubleshooting",
      status: "PASS",
      detail: `guide state "${detail.guidance?.state}", ${detail.guidance?.stepAttempts.length} step(s) attempted`,
    };
  } catch (err) {
    guidedTroubleshooting = { leg: "guided-troubleshooting", status: "FAIL", detail: describeError(err) };
  }

  try {
    remediation = await runRemediationLeg(session);
  } catch (err) {
    remediation = { leg: "whitelisted-remediation", status: "FAIL", detail: describeError(err) };
  }

  return { intake, classification, ticketCreation, guidedTroubleshooting, remediation };
}

async function runRemediationLeg(session: { sessionId: string; conversationId: string }): Promise<LegResult> {
  const listener = await SseListener.open(session.sessionId);
  try {
    // Nudge again in case the first reply only advanced the step without
    // yet surfacing a proposal (proposeActionForStep runs after the step
    // prompt is sent, per conversation-guidance.ts).
    const proposalPromise = listener.waitFor("action_proposed", 20_000);
    await postMessage(session.conversationId, session.sessionId, "can you check the print queue directly?");
    const proposal = (await proposalPromise) as { ticketId: string; proposalId: string; tier: string; description: string };

    const consentRes = await fetch(
      `${BASE_URL}/api/tickets/${encodeURIComponent(proposal.ticketId)}/actions/consent?sessionId=${encodeURIComponent(session.sessionId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.proposalId, granted: true }),
      },
    );
    if (consentRes.status !== 200) {
      return { leg: "whitelisted-remediation", status: "FAIL", detail: `consent POST returned ${consentRes.status}` };
    }
    const { result } = (await consentRes.json()) as {
      result: { outcome: string; approvalId?: string; description: string };
    };

    if (result.outcome === "pending_approval" && result.approvalId) {
      pendingApprovalId = result.approvalId;
      pendingApprovalDescription = result.description;
      return {
        leg: "whitelisted-remediation",
        status: "PASS",
        detail: `state-changing proposal "${result.description}" consented and raised for staff approval (${result.approvalId})`,
      };
    }
    if (proposal.tier === "read_only" && (result.outcome === "succeeded" || result.outcome === "attempted_unverified")) {
      // A read-only diagnostic executed immediately; ask once more for the
      // state-changing fix so the approval leg still gets exercised.
      return await runRemediationLeg(session);
    }
    return {
      leg: "whitelisted-remediation",
      status: "FAIL",
      detail: `unexpected consent outcome "${result.outcome}" for tier "${proposal.tier}"`,
    };
  } finally {
    listener.close();
  }
}

// Set by the employee-side consent step, read by the staff-side approval
// step later in the same run — this is the "no hand-edited data between
// stages" continuity the script exists to prove.
let pendingApprovalId: string | null = null;
let pendingApprovalDescription = "";

async function approvePendingRemediation(staffCookie: string): Promise<LegResult> {
  if (!pendingApprovalId) {
    return { leg: "whitelisted-remediation", status: "FAIL", detail: "no pending approval was raised by the employee leg" };
  }
  const res = await fetch(`${BASE_URL}/api/staff/approvals/${encodeURIComponent(pendingApprovalId)}/approve`, {
    method: "POST",
    headers: { Cookie: staffCookie },
  });
  if (res.status !== 200) {
    return { leg: "whitelisted-remediation", status: "FAIL", detail: `approval POST returned ${res.status}` };
  }
  const { result } = (await res.json()) as { result: { execution: { outcome: string; observedOutput: string | null } | null } };
  if (result.execution?.outcome === "succeeded") {
    return {
      leg: "whitelisted-remediation",
      status: "PASS",
      detail: `"${pendingApprovalDescription}" approved and executed against the registered test endpoint: ${result.execution.observedOutput ?? "(no output)"}`,
    };
  }
  return {
    leg: "whitelisted-remediation",
    status: "FAIL",
    detail: `execution outcome was "${result.execution?.outcome ?? "none"}", expected "succeeded"`,
  };
}

async function runEscalationAndTakeover(employeeCookie: string, staffCookie: string): Promise<{ escalation: LegResult; staffTakeover: LegResult }> {
  const session = await createSession(employeeCookie);
  const priorTicketRefs = await snapshotTicketReferences(session.sessionId);
  await postReportAndClearDuplicateCheck(session, "my mouse and keyboard stopped responding");
  const ticket = await waitForNewTicket(session.sessionId, priorTicketRefs, 15_000);

  await postMessage(session.conversationId, session.sessionId, "just get me a person please");
  let escalation: LegResult;
  let escalatedTicket: TicketSummary;
  try {
    escalatedTicket = await waitFor(async () => {
      const detail = await getTicketDetail(ticket.reference, session.sessionId);
      return detail.escalated ? detail : null;
    }, 15_000);
    escalation = {
      leg: "escalation",
      status: "PASS",
      detail: `ticket ${escalatedTicket.reference} escalated (${escalatedTicket.escalationReason ?? "reason unrecorded"}), handlingMode="${escalatedTicket.handlingMode}"`,
    };
  } catch (err) {
    return {
      escalation: { leg: "escalation", status: "FAIL", detail: describeError(err) },
      staffTakeover: { leg: "staff-takeover", status: "FAIL", detail: "blocked: ticket never escalated" },
    };
  }

  const takeoverRes = await fetch(`${BASE_URL}/api/staff/tickets/${encodeURIComponent(escalatedTicket.reference)}/takeover`, {
    method: "POST",
    headers: { Cookie: staffCookie },
  });
  const staffTakeover: LegResult =
    takeoverRes.status === 200
      ? { leg: "staff-takeover", status: "PASS", detail: `staff claimed ticket ${escalatedTicket.reference}` }
      : { leg: "staff-takeover", status: "FAIL", detail: `takeover POST returned ${takeoverRes.status}` };

  return { escalation, staffTakeover };
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const results: LegResult[] = [];

  try {
    await ensureStaffAccount();
    const employeeCookie = await authenticateEmployee();
    const staffCookie = await authenticateStaff();

    const printerLeg = await runIntakeThroughGuidance(employeeCookie);
    results.push(printerLeg.intake, printerLeg.classification, printerLeg.ticketCreation, printerLeg.guidedTroubleshooting);

    const { escalation, staffTakeover } = await runEscalationAndTakeover(employeeCookie, staffCookie);
    results.push(escalation, staffTakeover);

    // Approval happens last, after staff is confirmed signed in and the
    // takeover leg has run — mirrors "staff dashboard view and takeover"
    // preceding remediation in specs/005/quickstart.md's Release gate.
    if (printerLeg.remediation.status === "PASS" && pendingApprovalId) {
      results.push(await approvePendingRemediation(staffCookie));
    } else {
      results.push(printerLeg.remediation);
    }
  } catch (err) {
    // An unhandled error partway through still produces a log — every leg
    // not already recorded shows as SKIPPED, which fails the run honestly
    // rather than losing the attempt.
    console.error(err);
  }

  const finishedAt = new Date().toISOString();
  const log = buildLog(results, startedAt, finishedAt);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${startedAt.replace(/[:.]/g, "-")}.md`);
  await appendFile(outputPath, log, "utf-8");

  console.log(log);
  console.log(`Log written to ${outputPath}`);

  if (!allLegsPassed(results)) {
    process.exitCode = 1;
  }
}

// pathToFileURL, not string concatenation: on Windows a naive `file://${argv[1]}`
// never equals import.meta.url (which is drive-lettered and triple-slashed,
// e.g. file:///C:/...), so the naive comparison silently never runs main().
const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
