import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportPage } from "../../src/pages/staff/ImportPage";
const uploadImport = vi.fn(); const mapImport = vi.fn(); const previewImport = vi.fn(); const applyImport = vi.fn();
vi.mock("../../src/services/api", () => ({ ApiError: class ApiError extends Error {}, uploadImport: (...args: unknown[]) => uploadImport(...args), mapImport: (...args: unknown[]) => mapImport(...args), previewImport: (...args: unknown[]) => previewImport(...args), applyImport: (...args: unknown[]) => applyImport(...args) }));
describe("ImportPage", () => {
  it("explains the safe import sequence", () => { render(<ImportPage />); expect(screen.getByRole("heading", { name: "Import users" })).toBeInTheDocument(); expect(screen.getByText(/Upload, map, preview, then apply/)).toBeInTheDocument(); });
  it("shows preview separately, then replaces it with applied outcomes and disables upload", async () => {
    uploadImport.mockResolvedValue({ importId: "i1", columns: ["Email"] }); mapImport.mockResolvedValue({ ok: true });
    previewImport.mockResolvedValue({ outcomes: [{ row: 2, email: "a@example.test", outcome: "created" }] });
    applyImport.mockResolvedValue({ outcomes: [{ row: 2, email: "a@example.test", outcome: "created", initialPassword: "Temp-secret" }, { row: 3, email: "", outcome: "rejected", reason: "Invalid email" }] });
    render(<ImportPage />); const file = new File(["sheet"], "users.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(screen.getByLabelText(/excel workbook/i), { target: { files: [file] } }); await screen.findByText("Column mapping");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "email" } }); fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByRole("heading", { name: "Preview outcomes" })).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Apply import" }));
    expect(await screen.findByRole("heading", { name: "Applied outcomes" })).toBeInTheDocument(); expect(screen.getByText("Temp-secret")).toBeInTheDocument(); expect(screen.getByText("Invalid email")).toBeInTheDocument(); expect(screen.getByLabelText(/excel workbook/i)).toBeDisabled();
  });
  it("retries the failed preview step", async () => { uploadImport.mockResolvedValue({ importId: "i1", columns: ["Email"] }); mapImport.mockResolvedValue({ ok: true }); previewImport.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ outcomes: [{ row: 2, email: "a@example.test", outcome: "created" }] }); render(<ImportPage />); fireEvent.change(screen.getByLabelText(/excel workbook/i), { target: { files: [new File(["x"], "users.xlsx")] } }); await screen.findByText("Column mapping"); fireEvent.click(screen.getByRole("button", { name: "Preview" })); expect(await screen.findByRole("alert")).toHaveTextContent("offline"); fireEvent.click(screen.getByRole("button", { name: /retry preview/i })); await waitFor(() => expect(previewImport).toHaveBeenCalledTimes(2)); });
});
