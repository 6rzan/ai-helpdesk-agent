import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuickReplies } from "../../src/components/QuickReplies";

describe("QuickReplies", () => {
  it("renders the three chips", () => {
    render(<QuickReplies onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "That worked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Didn't work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Talk to a human" })).toBeInTheDocument();
  });

  it("sends plain text for the clicked chip", () => {
    const onSend = vi.fn();
    render(<QuickReplies onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "That worked" }));
    expect(onSend).toHaveBeenCalledWith("That worked");
  });

  it("sends plain text (not an emoji or icon-only label) for the human handoff chip", () => {
    const onSend = vi.fn();
    render(<QuickReplies onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Talk to a human" }));
    expect(onSend).toHaveBeenCalledWith(expect.stringMatching(/^[\x00-\x7F]*$/));
  });

  it("applies a press-state class that respects prefers-reduced-motion", () => {
    render(<QuickReplies onSend={vi.fn()} />);
    const button = screen.getByRole("button", { name: "That worked" });
    expect(button).toHaveClass("active:scale-[0.98]");
    expect(button).toHaveClass("motion-reduce:transition-none");
  });

  it("disables chips when disabled is true", () => {
    render(<QuickReplies onSend={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "That worked" })).toBeDisabled();
  });
});
