import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SessionForm } from "../../src/components/SessionForm";

describe("SessionForm", () => {
  it("submits the trimmed org ID and display name", () => {
    const onSubmit = vi.fn();
    render(<SessionForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/organisation id/i), { target: { value: " TP123456 " } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: " Alex Chen " } });
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    expect(onSubmit).toHaveBeenCalledWith("TP123456", "Alex Chen");
  });

  it("disables the submit button and shows submitting state", () => {
    render(<SessionForm onSubmit={vi.fn()} isSubmitting />);

    const button = screen.getByRole("button", { name: /starting/i });
    expect(button).toBeDisabled();
  });

  it("renders an error message when provided", () => {
    render(<SessionForm onSubmit={vi.fn()} error="Organisation not found" />);

    expect(screen.getByText("Organisation not found")).toBeInTheDocument();
  });

  it("does not call onSubmit when required fields are empty", () => {
    const onSubmit = vi.fn();
    render(<SessionForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
