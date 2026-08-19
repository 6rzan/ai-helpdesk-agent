import type { IssueCategory } from "../../models/enums.js";
import type {
  ClassifyAndReplyInput,
  ClassifyAndReplyResult,
  InterpretStepReplyInput,
  InterpretStepReplyResult,
  LlmProvider,
  ProposeActionInput,
  ProposeActionResult,
  StreamReplyInput,
} from "./types.js";

const KEYWORD_RULES: { category: IssueCategory; keywords: string[] }[] = [
  { category: "password_login", keywords: ["password", "login", "log in", "locked out", "sign in"] },
  { category: "network", keywords: ["network", "wifi", "wi-fi", "internet", "vpn", "connection"] },
  { category: "printer", keywords: ["printer", "print", "printing", "toner"] },
  { category: "peripherals", keywords: ["mouse", "keyboard", "monitor", "webcam", "headset", "peripheral"] },
  { category: "performance", keywords: ["slow", "freeze", "freezing", "lag", "crash", "performance"] },
  { category: "service_status", keywords: ["outage", "down", "unavailable", "service status"] },
];

// Lightweight lexicon scan used by the conversation loop to spot messages that
// bundle several distinct problems (spec edge case: one issue at a time).
// 005: the fixed set of read-only test tools (contracts/tools.md), each with
// one known-valid argument set so the mock provider can propose something
// real without a model. Not present here at all means "never propose this
// tool" — currently every state-changing tool, deliberately, since Phase 3
// registers no state-changing tools and later phases gate them on approval.
const KNOWN_TOOL_ARGUMENTS: Record<string, Record<string, string>> = {
  account_status: { username: "test-user-locked" },
  network_probe: { target: "test-node-a" },
  print_queue_status: {},
  peripheral_list: {},
  service_status: { service: "widget-service" },
};

export function detectTopics(text: string): IssueCategory[] {
  const lower = text.toLowerCase();
  return KEYWORD_RULES.filter((rule) => rule.keywords.some((kw) => lower.includes(kw))).map(
    (rule) => rule.category,
  );
}

export class MockLlmProvider implements LlmProvider {
  async classifyAndReply(input: ClassifyAndReplyInput): Promise<ClassifyAndReplyResult> {
    const text = input.latestMessage.toLowerCase();
    const match = KEYWORD_RULES.find((rule) => rule.keywords.some((kw) => text.includes(kw)));

    if (match) {
      return {
        ok: true,
        category: match.category,
        confidence: 0.9,
        reply: `Thanks — I've noted this as a ${match.category.replace("_", " ")} issue. I'm creating a ticket for you now.`,
      };
    }

    // R2/FR-014: categories added dynamically via the admin API aren't in the
    // static KEYWORD_RULES table, so fall back to matching the category's own
    // name (underscores as spaces) against the report text — keeps the mock
    // provider usable for testing classification into non-mandated categories.
    const dynamicMatch = input.categories.find(
      (c) => text.includes(c.name) || text.includes(c.name.replace(/_/g, " ")),
    );
    if (dynamicMatch) {
      return {
        ok: true,
        category: dynamicMatch.name,
        confidence: 0.9,
        reply: `Thanks — I've noted this as a ${dynamicMatch.name.replace(/_/g, " ")} issue. I'm creating a ticket for you now.`,
      };
    }

    return {
      ok: true,
      category: "unclassified",
      confidence: 0.4,
      reply: "Could you share a bit more detail about the issue you're facing?",
    };
  }

  async *streamReply(input: StreamReplyInput): AsyncIterable<string> {
    const result = await this.classifyAndReply({
      history: input.history,
      latestMessage: input.latestMessage,
      categories: [],
    });
    const reply = result.ok ? result.reply : "Sorry, I'm having trouble reaching the assistant right now.";
    for (const word of reply.split(" ")) {
      yield `${word} `;
    }
  }

  async interpretStepReply(input: InterpretStepReplyInput): Promise<InterpretStepReplyResult> {
    const text = input.latestMessage.toLowerCase();

    if (/\b(human|person|agent|representative|talk to someone)\b/.test(text)) {
      return { ok: true, outcome: "wants_human", confidence: 0.9, reply: "Connecting you with a person now." };
    }
    if (text.includes("?")) {
      return { ok: true, outcome: "question", confidence: 0.7, reply: "Let me clarify that step for you." };
    }
    if (/already (tried|did|done)/.test(text)) {
      return { ok: true, outcome: "already_tried", confidence: 0.85, reply: "Got it — let's move to the next step." };
    }
    if (/\b(worked|fixed|resolved|solved|working now)\b/.test(text)) {
      return { ok: true, outcome: "worked", confidence: 0.9, reply: "Great, glad that fixed it!" };
    }
    if (/\b(still|not working|didn't work|doesn't work|no luck|nope)\b/.test(text)) {
      return { ok: true, outcome: "not_worked", confidence: 0.85, reply: "Thanks — let's try the next step." };
    }

    return { ok: true, outcome: "unclear", confidence: 0.3, reply: "Sorry, could you tell me if that step worked?" };
  }

  // Deterministic stand-in for a real model's tool selection, using known-good
  // arguments for each of the fixed test tools (mirrors KEYWORD_RULES above) —
  // this is what lets integration tests exercise the full plan/validate/act
  // pipeline against the test endpoints without a real LLM. Proposes the first
  // offered tool it recognizes and has not already tried this turn; anything
  // it does not recognize gets no proposal, matching a real model asked about
  // an unregistered tool it was never told about.
  async proposeAction(input: ProposeActionInput): Promise<ProposeActionResult> {
    for (const tool of input.tools) {
      const args = KNOWN_TOOL_ARGUMENTS[tool.name];
      if (!args) {
        continue;
      }
      const alreadyTried = input.attempts.some((attempt) => attempt.toolName === tool.name);
      if (alreadyTried) {
        continue;
      }
      return { ok: true, proposal: { toolName: tool.name, arguments: args } };
    }
    return { ok: true, proposal: null };
  }

  async health(): Promise<boolean> {
    return true;
  }
}
