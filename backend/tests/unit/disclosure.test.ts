import { describe, expect, it } from "vitest";
import { asClause, isPasswordPathEntry, TEST_ACCOUNT_DISCLOSURE } from "../../src/services/remediation/disclosure.js";

// T084/T085 (OBS-11): policy entry descriptions in action-policy.json are
// authored as whole sentences because the staff approval queue renders each as
// a standalone block. Every reporter-facing message that embeds one *mid*
// sentence has to drop the authored full stop first, or the copy doubles it
// ("...print queue.. I'll let you know"). asClause is that single rule, and it
// is exercised here rather than left to the integration suites alone.

describe("asClause", () => {
  it("TC: drops the authored trailing full stop so the description can sit mid-sentence", () => {
    expect(asClause("Clears the endpoint's print queue.")).toBe("Clears the endpoint's print queue");
  });

  it("TC: leaves a description that carries no trailing full stop untouched", () => {
    expect(asClause("Clears the endpoint's print queue")).toBe("Clears the endpoint's print queue");
  });

  it("TC: drops trailing whitespace around the full stop as well", () => {
    expect(asClause("Unlocks a locked local test account on the endpoint. ")).toBe(
      "Unlocks a locked local test account on the endpoint",
    );
  });

  it("TC: preserves an internal full stop, trimming only the final one", () => {
    // The multi-sentence entries (account_status, list_devices) must keep their
    // first sentence intact.
    expect(asClause("Lists devices visible to the endpoint. This is the container's own view.")).toBe(
      "Lists devices visible to the endpoint. This is the container's own view",
    );
  });

  it("TC: never produces a doubled full stop when the caller appends its own", () => {
    const rendered = `That needs IT staff sign-off first: ${asClause("Clears the endpoint's print queue.")}. I'll let you know as soon as it's decided.`;
    expect(rendered).not.toContain("..");
    expect(rendered).toBe(
      "That needs IT staff sign-off first: Clears the endpoint's print queue. I'll let you know as soon as it's decided.",
    );
  });

  it("TC: returns an empty string unchanged rather than throwing", () => {
    expect(asClause("")).toBe("");
  });
});

describe("password-path disclosure", () => {
  it("TC: recognises exactly the two password-path policy entries", () => {
    expect(isPasswordPathEntry("unlock-account")).toBe(true);
    expect(isPasswordPathEntry("expire-password")).toBe(true);
    expect(isPasswordPathEntry("clear-print-queue")).toBe(false);
  });

  it("TC: the disclosure names the test account and carries no em-dash (FR-019, NFR-2)", () => {
    expect(TEST_ACCOUNT_DISCLOSURE).toContain("local test account on the test system");
    expect(TEST_ACCOUNT_DISCLOSURE).not.toContain("—");
  });
});
