import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportPage } from "../../src/pages/staff/ImportPage";
vi.mock("../../src/services/api", () => ({ uploadImport: vi.fn(), mapImport: vi.fn(), previewImport: vi.fn(), applyImport: vi.fn() }));
describe("ImportPage", () => { it("explains the safe import sequence", () => { render(<ImportPage />); expect(screen.getByRole("heading", { name: "Import users" })).toBeInTheDocument(); expect(screen.getByText(/Upload, map, preview, then apply/)).toBeInTheDocument(); }); });
