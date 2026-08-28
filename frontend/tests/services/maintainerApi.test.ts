import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MaintainerApiError,
  getMaintainerStatus,
  listMaintainerCategories,
  publishMaintainerGuide,
  retireMaintainerCategory,
} from "../../src/services/maintainerApi";

// T017 (007). FR-014 and FR-015 are claims about where the maintainer key can end up,
// and the only way to test "nowhere" is to check every place it could go. These assert
// against the real browser-ish surfaces (fetch arguments, storage, cookies, the URL)
// rather than against the module's intentions.

const KEY = "a-real-looking-maintainer-key-8f21";
const CREDENTIALS = { key: KEY, name: "Jordan Maintainer" };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("maintainerApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ categories: [] }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the key and name as per-request headers", async () => {
    await listMaintainerCategories(CREDENTIALS);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/maintainer/categories");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-maintainer-key"]).toBe(KEY);
    expect(headers["x-maintainer-name"]).toBe("Jordan Maintainer");
  });

  it("never sets credentials: include", async () => {
    // The shared `request()` in services/api.ts sends cookies on every call. The
    // maintainer is not an account and has no session, so this axis must not carry one
    // in either direction.
    await listMaintainerCategories(CREDENTIALS);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBeUndefined();
  });

  it("never puts the key in the URL", async () => {
    // A key in a URL reaches the browser history, the server access log, and the
    // referrer header — three places it survives long after the console is closed.
    await listMaintainerCategories(CREDENTIALS);
    await retireMaintainerCategory(CREDENTIALS, "some_category");
    await publishMaintainerGuide(CREDENTIALS, "some_category", { steps: [] });
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain(KEY);
    }
  });

  it("never writes the key to localStorage, sessionStorage, or a cookie", async () => {
    await listMaintainerCategories(CREDENTIALS);
    expect(JSON.stringify(localStorage)).not.toContain(KEY);
    expect(JSON.stringify(sessionStorage)).not.toContain(KEY);
    expect(document.cookie).not.toContain(KEY);
  });

  it("holds no module-level default header — a later call without credentials cannot reuse the key", async () => {
    // The key is a parameter, not module state. If the module cached it, this second
    // call would still carry it, which is the leak FR-014 forbids.
    await listMaintainerCategories(CREDENTIALS);
    fetchMock.mockClear();

    await listMaintainerCategories({ key: "", name: "Someone Else" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-maintainer-key"]).toBe("");
    expect(JSON.stringify(headers)).not.toContain(KEY);
  });

  it("exposes no setter that could hold the key", async () => {
    const module = await import("../../src/services/maintainerApi");
    const exported = Object.keys(module);
    expect(exported).not.toContain("setMaintainerKey");
    expect(exported).not.toContain("setCredentials");
    expect(exported).not.toContain("maintainerKey");
  });

  it("shares no code path with services/api.ts — the key cannot reach it", async () => {
    // Asserted at the source level: an import of api.ts here would mean the two callers
    // could converge later, and this is the file that must not converge.
    const source = await import("../../src/services/maintainerApi?raw");
    const text = (source as unknown as { default: string }).default;
    expect(text).not.toContain('from "./api"');
    expect(text).not.toContain("from './api'");
  });

  it("reads the status probe without credentials", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: false }));
    const status = await getMaintainerStatus();
    expect(status).toEqual({ enabled: false });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe("/api/maintainer/status");
    expect(JSON.stringify(init ?? {})).not.toContain(KEY);
  });

  it("surfaces retryAfterSeconds from a throttled response", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: { code: "MAINTAINER_SIGNIN_THROTTLED", message: "Sign-in is paused." },
          retryAfterSeconds: 240,
        },
        429,
      ),
    );

    await expect(listMaintainerCategories(CREDENTIALS)).rejects.toBeInstanceOf(MaintainerApiError);
    try {
      await listMaintainerCategories(CREDENTIALS);
    } catch (err) {
      const error = err as MaintainerApiError;
      expect(error.status).toBe(429);
      expect(error.code).toBe("MAINTAINER_SIGNIN_THROTTLED");
      // Read from the server, not counted locally: the window is backend policy.
      expect(error.retryAfterSeconds).toBe(240);
    }
  });

  it("surfaces stepIndex and field from a rejected guide step", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: { code: "GUIDE_STEP_INVALID", message: "Step 3 needs a success hint." },
          stepIndex: 2,
          field: "successHint",
        },
        400,
      ),
    );

    try {
      await publishMaintainerGuide(CREDENTIALS, "printer", { steps: [] });
      throw new Error("expected a rejection");
    } catch (err) {
      const error = err as MaintainerApiError;
      expect(error.code).toBe("GUIDE_STEP_INVALID");
      expect(error.stepIndex).toBe(2);
      expect(error.field).toBe("successHint");
    }
  });

  it("returns null for retryAfterSeconds and stepIndex on an unrelated error", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "CATEGORY_NOT_FOUND", message: "Unknown category" } }, 404),
    );
    try {
      await listMaintainerCategories(CREDENTIALS);
      throw new Error("expected a rejection");
    } catch (err) {
      const error = err as MaintainerApiError;
      expect(error.retryAfterSeconds).toBeNull();
      expect(error.stepIndex).toBeNull();
      expect(error.field).toBeNull();
    }
  });
});
