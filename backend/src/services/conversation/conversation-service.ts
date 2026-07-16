/**
 * Public conversation-service boundary.
 *
 * The implementation lives in conversation-engine.ts so route and service
 * consumers depend on a stable, small module while the message-processing
 * pipeline can be decomposed independently in future changes.
 */
export {
  detectScope,
  isContentFree,
  detectMultiProblem,
  handleIncomingMessage,
} from "./conversation-engine.js";
export type {
  ScopeCheck,
  MultiProblemHit,
  HandleIncomingMessageInput,
  HandleIncomingMessageResult,
} from "./conversation-engine.js";
export type { GuidedFlowStart } from "./conversation-guidance.js";
