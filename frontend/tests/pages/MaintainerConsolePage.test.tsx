import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MaintainerConsolePage } from "../../src/pages/maintainer/MaintainerConsolePage";

// T018 (007). The console's three refusals and two mid-session transitions.
//
// `fetch` is stubbed rather than the api module, so the real MaintainerApiError does the
// classifying — the same code path production uses. Mocking the module would let these
// tests pass while the error mapping was broken.

const KEY = "a-real-looking-maintainer-key-8f21";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const STATUS_ENABLED = jsonResponse({ enabled: true });
const STATUS_DISABLED = jsonResponse({ enabled: false });
const EMPTY_CATEGORIES = jsonResponse({ categories: [] });

function errorResponse(status: number, code: string, extra: Record<string, unknown> = {}) {
  return jsonResponse({ error: { code, message: "Refused." }, ...extra }, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

/** Queues responses in call order: the status probe first, then whatever follows. */
function respondInOrder(...responses: Response[]) {
  let index = 0;
  fetchMock.mockImplementation(() => {
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return Promise.resolve(response);
  });
}

async function signIn() {
  fireEvent.change(screen.getByLabelText(/maintainer key/i), { target: { value: KEY } });
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jordan" } });
  fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MaintainerConsolePage — administration switched off (FR-005)", () => {
  it("MC-001: renders no sign-in form at all when administration is off", async () => {
    respondInOrder(STATUS_DISABLED);
    render(<MaintainerConsolePage />);

    await screen.findByText(/not enabled/i);
    // The whole point: not a disabled form, not a form that fails on submit. Absent.
    expect(screen.queryByLabelText(/maintainer key/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^sign in$/i })).toBeNull();
  });

  it("MC-002: the switched-off message never suggests the key was wrong", async () => {
    respondInOrder(STATUS_DISABLED);
    const { container } = render(<MaintainerConsolePage />);
    await screen.findByText(/not enabled/i);
    expect(container.textContent ?? "").not.toMatch(/not accepted|incorrect|invalid/i);
  });

  it("MC-003: renders the sign-in form when administration is on", async () => {
    respondInOrder(STATUS_ENABLED);
    render(<MaintainerConsolePage />);
    expect(await screen.findByLabelText(/maintainer key/i)).toBeTruthy();
  });
});

describe("MaintainerConsolePage — refused sign-in (FR-004, FR-034)", () => {
  it("MC-004: a wrong key gets one fixed message with no hint about the key itself", async () => {
    respondInOrder(STATUS_ENABLED, errorResponse(401, "MAINTAINER_KEY_INVALID"));
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/was not accepted/i);
    // No proximity, length, or format hint: those turn a refusal into a guessing aid.
    expect(alert.textContent ?? "").not.toMatch(/close|almost|length|characters|starts with/i);
  });

  it("MC-005: a cooling-off refusal reads differently from a wrong key", async () => {
    respondInOrder(
      STATUS_ENABLED,
      errorResponse(429, "MAINTAINER_SIGNIN_THROTTLED", { retryAfterSeconds: 300 }),
    );
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/too many failed attempts/i);
    // Must not read as another wrong-key message, or the maintainer retypes a correct
    // key, is refused again, and concludes the key is wrong.
    expect(alert.textContent ?? "").not.toMatch(/was not accepted/i);
  });

  it("MC-006: the cooling-off duration comes from the server, not a hardcoded number", async () => {
    respondInOrder(
      STATUS_ENABLED,
      errorResponse(429, "MAINTAINER_SIGNIN_THROTTLED", { retryAfterSeconds: 120 }),
    );
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/2 minutes/);
  });

  it("MC-007: submitting is unavailable while cooling off", async () => {
    respondInOrder(
      STATUS_ENABLED,
      errorResponse(429, "MAINTAINER_SIGNIN_THROTTLED", { retryAfterSeconds: 300 }),
    );
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();
    await screen.findByRole("alert");

    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeDisabled();
  });

  it("MC-008: a throttled response with no duration still says the pause is temporary", async () => {
    respondInOrder(STATUS_ENABLED, errorResponse(429, "MAINTAINER_SIGNIN_THROTTLED"));
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/paused/i);
    expect(alert.textContent).not.toMatch(/NaN|undefined/);
  });

  it("MC-009: an unreachable server is not reported as a wrong key", async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).endsWith("/status")
        ? Promise.resolve(STATUS_ENABLED)
        : Promise.reject(new TypeError("network down")),
    );
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not reach/i);
    expect(alert.textContent ?? "").not.toMatch(/was not accepted/i);
  });
});

describe("MaintainerConsolePage — mid-session transitions", () => {
  it("MC-010: a rotated key returns to sign-in with an explanation, not a dead screen", async () => {
    // The sign-in call succeeds; the console's first load inside the console fails 401.
    respondInOrder(
      STATUS_ENABLED,
      EMPTY_CATEGORIES,
      errorResponse(401, "MAINTAINER_KEY_INVALID"),
    );
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/no longer accepted/i);
    // Back at the sign-in form rather than an error page.
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeTruthy();
  });

  it("MC-011: a rotated key is discarded from the field, not left for a retry", async () => {
    respondInOrder(
      STATUS_ENABLED,
      EMPTY_CATEGORIES,
      errorResponse(401, "MAINTAINER_KEY_INVALID"),
    );
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();
    await screen.findByRole("alert");

    expect(screen.getByLabelText(/maintainer key/i)).toHaveValue("");
  });

  it("MC-012: administration switched off mid-session renders the switched-off state", async () => {
    respondInOrder(STATUS_ENABLED, EMPTY_CATEGORIES, errorResponse(404, "NOT_FOUND"));
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();

    await screen.findByText(/not enabled/i);
    // Not a generic "not found": that describes the route, not what happened.
    expect(screen.queryByLabelText(/maintainer key/i)).toBeNull();
  });
});

describe("MaintainerConsolePage — the key is not retained (FR-014)", () => {
  it("MC-013: signing in writes the key to no storage and no cookie", async () => {
    respondInOrder(STATUS_ENABLED, EMPTY_CATEGORIES, EMPTY_CATEGORIES);
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);

    signIn();
    await waitFor(() => expect(screen.queryByLabelText(/maintainer key/i)).toBeNull());

    expect(JSON.stringify(localStorage)).not.toContain(KEY);
    expect(JSON.stringify(sessionStorage)).not.toContain(KEY);
    expect(document.cookie).not.toContain(KEY);
  });

  it("MC-014: a reload starts signed out — there is nowhere for the key to have survived", async () => {
    respondInOrder(STATUS_ENABLED, EMPTY_CATEGORIES, EMPTY_CATEGORIES);
    const first = render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);
    signIn();
    await waitFor(() => expect(screen.queryByLabelText(/maintainer key/i)).toBeNull());
    first.unmount();

    respondInOrder(STATUS_ENABLED);
    render(<MaintainerConsolePage />);

    // Signed out again, with an empty field: the key lived in component state only.
    expect(await screen.findByLabelText(/maintainer key/i)).toHaveValue("");
  });

  it("MC-015: signing out clears the field and returns to sign-in without a refusal message", async () => {
    respondInOrder(STATUS_ENABLED, EMPTY_CATEGORIES, EMPTY_CATEGORIES);
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);
    signIn();
    await waitFor(() => expect(screen.queryByLabelText(/maintainer key/i)).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(await screen.findByLabelText(/maintainer key/i)).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("MC-016: the maintainer's name is sent as a header, never the key in a URL", async () => {
    respondInOrder(STATUS_ENABLED, EMPTY_CATEGORIES, EMPTY_CATEGORIES);
    render(<MaintainerConsolePage />);
    await screen.findByLabelText(/maintainer key/i);
    signIn();
    await waitFor(() => expect(screen.queryByLabelText(/maintainer key/i)).toBeNull());

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain(KEY);
    }
    const authed = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.headers,
    );
    const headers = (authed?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers["x-maintainer-key"]).toBe(KEY);
    expect(headers["x-maintainer-name"]).toBe("Jordan");
  });
});
