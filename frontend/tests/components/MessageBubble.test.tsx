import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "../../src/components/MessageBubble";

describe("MessageBubble", () => {
  it("renders the message text", () => {
    render(<MessageBubble author="agent" text="How can I help?" />);

    expect(screen.getByText("How can I help?")).toBeInTheDocument();
  });

  it("shows a streaming cursor while isStreaming is true", () => {
    const { container } = render(<MessageBubble author="agent" text="Thinking" isStreaming />);

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("does not show a streaming cursor by default", () => {
    const { container } = render(<MessageBubble author="user" text="I forgot my password" />);

    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it.each([
    ["user", "self-end"],
    ["agent", "self-start"],
    ["system", "self-center"],
  ] as const)("applies the %s author's alignment style", (author, expectedClass) => {
    const { container } = render(<MessageBubble author={author} text="hi" />);

    expect(container.firstElementChild).toHaveClass(expectedClass);
  });

  // FR-016/T061 Design Direction: a policy refusal is a normal agent reply,
  // never an error state. It must render with the same neutral bubble as any
  // other agent message -- no red/amber "error" treatment keyed off content.
  it("renders a policy refusal in the plain agent style, never as an error", () => {
    const { container } = render(
      <MessageBubble
        author="agent"
        text="I don't have an approved way to do that myself, but I can report it and bring in IT staff who can — just ask me to escalate it and I will."
      />,
    );

    const bubble = container.firstElementChild;
    expect(bubble).toHaveClass("self-start", "bg-gray-100", "text-gray-900");
    expect(bubble).not.toHaveClass("border-red-200", "bg-red-50", "text-red-900");
    expect(bubble?.getAttribute("role")).not.toBe("alert");
  });
});
