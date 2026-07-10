import { describe, expect, it } from "vitest";
import { detectScope } from "../../src/services/conversation/conversation-service.js";

describe("scope refusal rules (FR-012)", () => {
  it("TC-048: non-IT requests are detected as off-topic", () => {
    expect(detectScope("Can you help me write my essay for class?")).toBe("off_topic");
    expect(detectScope("Tell me a joke")).toBe("off_topic");
    expect(detectScope("What's the weather like tomorrow?")).toBe("off_topic");
  });

  it("TC-049: requests for the agent to execute remediation are detected", () => {
    expect(detectScope("Could you reset my password for me?")).toBe("remediation");
    expect(detectScope("Can you reinstall the driver on my laptop?")).toBe("remediation");
    expect(detectScope("Will you delete my old account?")).toBe("remediation");
  });

  it("TC-050: ordinary IT issue reports stay in scope", () => {
    expect(detectScope("My printer is jammed and won't print")).toBe("in_scope");
    expect(detectScope("I forgot my password and can't log into my computer")).toBe("in_scope");
    expect(detectScope("The wifi keeps dropping in the lab")).toBe("in_scope");
  });
});
