# Feature Specification: Voice Input

**Feature Branch**: `002-voice-input`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Voice input for the AI Help Desk Agent — the deferred IR FR-1 voice path. Employees can speak their IT problem instead of typing it; speech is transcribed to text before any analysis, and the transcript flows through the existing conversation, classification, ticketing, clarification, and escalation pipeline unchanged. Slotted into the delivery order by constitution v1.1.1 (Principle VII)."

## Clarifications

### Session 2026-07-11

- Q: While a transcript is in the draft awaiting review, the user starts a new recording — what happens to the pending transcript? → A: The new recording's transcript is appended to the pending draft (voice joins voice exactly as voice joins typed text); recordings remain one-at-a-time and the user reviews the combined draft before sending.
- Q: Does voice input cover only conversation messages, or also the reporter identification step (org ID / display name) at session start? → A: Conversation messages only; the identification step remains typed-only.
- Q: What input origin does a message record when the draft combined a voice transcript with typed text, or when the user edited the transcript before sending? → A: One attribute with three values — typed, voice, or mixed. Voice = sent transcript including review corrections; typed = typed-only; mixed = draft joined typed text with a transcript.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Report an IT issue by speaking (Priority: P1)

An employee experiencing an IT problem opens the help desk chat, presses the microphone control, describes the problem out loud in their own words, and stops the recording. Their speech appears as text, they confirm it, and from that point everything behaves exactly as if they had typed it: the agent understands the report, classifies it, opens a ticket, and confirms in plain language with a ticket reference.

**Why this priority**: This is the whole feature — the IR FR-1 voice path. Voice input widens access to the help desk (hands-busy situations, users who find typing slow or difficult) without changing anything downstream. With only this story implemented, a user can already complete the full report-to-ticket journey by voice.

**Independent Test**: Speak a prepared set of problem reports covering all six support categories into the chat and verify each produces a transcript, and — once sent — the same classification, ticket, and plain-language confirmation its typed equivalent produces.

**Acceptance Scenarios**:

1. **Given** an open chat session with an identified reporter, **When** the user records "I forgot my password and can't log into my computer" and sends the transcript, **Then** the agent replies confirming a ticket in the password/login category with a ticket reference — identical in behaviour to the typed path.
2. **Given** a recording in progress, **When** the user is speaking, **Then** a clear visible indicator shows that audio is being captured, and the user can stop or cancel at any moment.
3. **Given** a completed recording, **When** transcription finishes, **Then** the spoken words appear as text the user can see before anything is sent to the agent.
4. **Given** a conversation where the user has already typed messages, **When** the user switches to voice for the next message (or back again), **Then** the conversation continues seamlessly — voice and typed messages mix freely in one conversation.

---

### User Story 2 - Review, correct, or discard the transcript before sending (Priority: P2)

Speech recognition is not perfect. Before a spoken report reaches the agent, the user sees the transcript, can fix any misheard words by editing it, and can discard it entirely and start over. Nothing is sent on the user's behalf without their confirmation.

**Why this priority**: Transcription errors are inevitable, and a wrongly transcribed report would poison classification and erode trust. Review-before-send is the safety net that keeps voice input as reliable as typing. It depends on capture and transcription (Story 1) existing.

**Independent Test**: Record utterances, verify the transcript is editable before sending, edit it, send, and confirm the agent received the edited text; separately, discard a transcript and verify nothing was sent and no ticket was created.

**Acceptance Scenarios**:

1. **Given** a finished transcription, **When** the transcript appears, **Then** the user can edit it exactly as they would edit typed text before sending.
2. **Given** a transcript with a misheard word, **When** the user corrects it and sends, **Then** the agent processes only the corrected text.
3. **Given** a transcript the user does not want to send, **When** they discard it, **Then** no message is sent, no ticket is created, and the user can immediately record again or type instead.
4. **Given** a transcript awaiting review, **When** the user does nothing, **Then** the system never auto-sends it.

---

### User Story 3 - Voice degrades gracefully; typing always works (Priority: P3)

Voice is an additional way in, never a gate. If the microphone is unavailable, permission is refused, speech recognition fails, or the transcription service is down, the user is told what happened in plain language and can simply type instead. Problem intake is never blocked by a voice failure.

**Why this priority**: The foundation guarantees intake never fully fails while the system runs; voice must not weaken that guarantee. It protects the availability promise (IR FR-5) but only matters once voice capture (Story 1) exists.

**Independent Test**: Simulate microphone permission denial, absent microphone, transcription failure, and transcription-service unavailability; verify each produces a plain-language explanation, the typed path remains fully functional, and no report is lost.

**Acceptance Scenarios**:

1. **Given** a user whose browser has no microphone access (denied or absent), **When** they try to use voice input, **Then** they see a plain-language explanation and the typed path continues to work unaffected.
2. **Given** the transcription capability is unavailable, **When** the user attempts a voice message, **Then** they are told voice is temporarily unavailable and invited to type — intake continues.
3. **Given** a recording that produces no recognisable speech (silence, noise), **When** transcription completes, **Then** the user is told nothing was understood and invited to retry or type; no message is sent and no ticket is created.
4. **Given** a transcription failure mid-attempt, **When** the failure occurs, **Then** the user's draft conversation state is preserved and they can retry by voice or continue by text.

---

### Edge Cases

- **Microphone permission denied or no microphone present**: plain-language explanation; typing unaffected (Story 3).
- **Silence or unintelligible audio**: user informed, invited to retry or type; nothing is sent; no ticket results from content-free audio.
- **Background noise or heavy accent produces a garbled transcript**: the review step (Story 2) lets the user correct or discard before anything reaches the agent.
- **Very long speech**: recording stops at a stated generous limit with a clear indication as the limit approaches; whatever was captured is transcribed and offered for review, and the user is invited to continue in a further message.
- **User leaves or the session ends mid-recording**: nothing is sent; no partial message or ticket is created; the conversation itself is unaffected.
- **User has typed a partial message, then records**: the transcript joins the drafted text rather than silently replacing it; the user reviews the combined draft before sending.
- **Non-English speech**: outside the system's stated language scope; whatever transcript results is shown for review, where the user can discard it — the agent itself continues to operate in English.
- **Repeated rapid recordings**: recordings are one-at-a-time; a new recording's transcript is appended to the pending draft — voice joins voice exactly as voice joins typed text — and the user reviews the combined draft before sending.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The chat MUST offer a voice capture control alongside typing at any point in a conversation; voice and typed messages MUST mix freely within the same conversation with no difference in downstream behaviour. Voice capture applies to conversation messages only — the reporter identification step (organisational identifier / display name) remains typed-only. *(IR FR-1 — voice path.)*
- **FR-002**: Audio capture MUST begin only on an explicit user action, MUST show a clear visible indicator while recording, and MUST be stoppable and cancellable by the user at any moment. There is no always-on listening and no wake word. *(IR NFR-5 — privacy by design.)*
- **FR-003**: Every voice recording MUST be transcribed to text before any analysis. All downstream processing — classification, ticket creation, clarification, escalation, status conversation — MUST operate on the transcript exactly as it operates on typed text, with no voice-specific behaviour. *(IR FR-1: all voice entries undergo transcription first; everything moves forward as text.)*
- **FR-004**: The transcript MUST be presented to the user for review before sending. The user MUST be able to send it unchanged, edit it first, or discard it. The system MUST NOT send a transcript without the user's confirmation.
- **FR-005**: Each message MUST record its input origin — typed, voice, or mixed — without that origin changing how the message is processed. Voice covers a sent transcript including any corrections made during review; typed covers typed-only messages; mixed covers drafts that combined typed text with a transcript. *(Supports evaluation and UAT evidence; IR §3.4.5 equivalence of entry methods.)*
- **FR-006**: Captured audio MUST be transient: discarded once transcription completes or the capture is cancelled. Only the sent transcript persists, as an ordinary conversation message. Audio MUST never be attached to tickets or stored with conversation history. *(IR NFR-5 — data minimisation.)*
- **FR-007**: In the reference configuration, audio MUST be processed entirely within the controlled environment — recorded audio never leaves it. Any alternative configuration that sends audio elsewhere MUST be an explicit, visible configuration choice. *(IR NFR-3, NFR-5; Constitution Principle VIII data-retention caution.)*
- **FR-008**: Recordings MUST respect a stated generous duration limit (configurable operational value, default 2 minutes), with a clear indication as the limit approaches; reaching it ends capture and offers the transcript so far for review — it never silently discards speech.
- **FR-009**: Failure or unavailability of transcription MUST NOT block intake: the user sees a plain-language notice, may retry, and the typed path remains fully functional throughout. *(Extends the foundation's intake-never-fails guarantee, IR FR-5.)*
- **FR-010**: When microphone access is denied or no microphone exists, the system MUST explain this in plain language and leave the typed path unaffected.
- **FR-011**: A recording containing no recognisable speech MUST result in a plain-language invitation to retry or type; it MUST NOT produce a sent message or a ticket.
- **FR-012**: All voice-related user-facing messages (indicators, errors, invitations) MUST use plain, jargon-free language. *(IR NFR-2.)*

### Key Entities

- **Voice Capture**: A transient audio recording in progress or awaiting transcription — never persisted beyond transcription, never linked to tickets. Exists only within the user's active session.
- **Transcript**: The text produced from a voice capture — reviewable and editable by the user; becomes an ordinary Message only when the user sends it.
- **Message (extended)**: The foundation's Message entity gains one attribute: input origin (typed, voice, or mixed — per FR-005). No other change; processing is origin-blind.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can report an issue entirely by voice — record, review, send — and receive a plain-language ticket confirmation with a reference in under 2 minutes, without instructions or training.
- **SC-002**: At least 90% of a prepared benchmark set of spoken reports (clear speech, quiet office conditions, covering all six support categories) produce transcripts that the agent classifies into the same category as their typed equivalents.
- **SC-003**: For utterances up to 30 seconds, the transcript is ready for review within 5 seconds of the user ending the recording, measured at the 90th percentile on the demo environment.
- **SC-004**: 100% of simulated transcription failures and unavailability cases show a plain-language notice and leave typed intake fully working — zero blocked intakes across the test set.
- **SC-005**: Zero audio recordings persist after transcription completes or capture is cancelled, verified by inspection of stored data across the entire test set.
- **SC-006**: Conversations mixing voice and typed messages produce identical classification and ticketing outcomes to their all-typed equivalents across 100% of a mixed-modality test set.
- **SC-007**: In UAT (minimum 3 testers per constitution Principle IV), all testers successfully report an issue by voice unaided, and rate the voice flow and its messages as clear. *(UAT is conducted at project level before final submission; this feature contributes its scenarios and must be UAT-ready.)*

## Assumptions

- **Review-before-send is the default**: transcripts always land in the user's hands for confirmation; there is no auto-send mode in this feature. This is the safety net for transcription errors and the basis of user trust.
- **English-language speech only**, consistent with the foundation's single-organisation, English-language scope. Non-English speech is handled only by the review step (the user sees and can discard a poor transcript).
- **Benchmark conditions are clear speech in a quiet office**; noisy environments are supported on a best-effort basis via transcript review and editing, not by an accuracy guarantee.
- **The recording duration limit defaults to 2 minutes** and is a configurable operational value, mirroring the foundation's configurable thresholds.
- **No voice output (text-to-speech), no wake word, no continuous listening, and no voice biometrics or speaker identification** — all out of scope. The IR requires voice input only; identification remains the foundation's lightweight organisational-identifier scheme.
- **This feature changes no downstream behaviour**: classification, ticketing, clarification, escalation, and status visibility are exactly as delivered by feature 001. Voice is purely an input-layer addition feeding the same conversation.
- **A working microphone and a browser able to capture audio are required for the voice path**; the typed path remains available on any device and is the universal fallback.
- **Voice processing fits the project's single demo machine** and stays inside the secured, isolated test environment (IR NFR-3); the reference configuration performs all speech processing locally.
