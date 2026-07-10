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
});
