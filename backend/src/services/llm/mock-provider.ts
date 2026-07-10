import type { IssueCategory } from "../../models/enums.js";
import type {
  ClassifyAndReplyInput,
  ClassifyAndReplyResult,
  LlmProvider,
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

    if (!match) {
      return {
        ok: true,
        category: "unclassified",
        confidence: 0.4,
        reply: "Could you share a bit more detail about the issue you're facing?",
      };
    }

    return {
      ok: true,
      category: match.category,
      confidence: 0.9,
      reply: `Thanks — I've noted this as a ${match.category.replace("_", " ")} issue. I'm creating a ticket for you now.`,
    };
  }

  async *streamReply(input: StreamReplyInput): AsyncIterable<string> {
    const result = await this.classifyAndReply({
      history: input.history,
      latestMessage: input.latestMessage,
    });
    const reply = result.ok ? result.reply : "Sorry, I'm having trouble reaching the assistant right now.";
    for (const word of reply.split(" ")) {
      yield `${word} `;
    }
  }

  async health(): Promise<boolean> {
    return true;
  }
}
