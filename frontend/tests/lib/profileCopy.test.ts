import { describe, expect, it } from "vitest";
import {
  ALL_FIELDS_LOCKED_EXPLANATION,
  LOCKED_FIELD_EXPLANATION,
  LOCKED_ON_SAVE_EXPLANATION,
  NO_RECORDED_AUTHOR_BYLINE,
  OWNER_CONTROLLED_NOTE,
  STAFF_CONTROLLED_NOTE,
  conflictExplanation,
  formatSetAt,
  provenanceByline,
} from "../../src/lib/profileCopy";

// T024 (007). These strings appear on three surfaces and SC-009 is measured on one of
// them, so the tests that matter are about the strings existing in exactly one place and
// every surface consuming them from there. A page that phrases the lock its own way
// passes its own tests and fails SC-009.

/** Every source file, read as text, so these tests can assert about the tree rather
 * than about one module's intentions. */
const SOURCES = import.meta.glob("../../src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("profileCopy — the byline", () => {
  it("PC-001: names who set the value and when", () => {
    const byline = provenanceByline("Ayesha Khan", "2026-03-12T14:20:00.000Z");
    expect(byline).toContain("Ayesha Khan");
    expect(byline).toMatch(/^Set by /);
  });

  it("PC-002: keeps the author's name as written, with no case folding", () => {
    // A name is a name. Lowercasing it to fit a sentence renders a person's name wrong.
    expect(provenanceByline("Ayesha Khan", "2026-03-12T14:20:00.000Z")).toContain("Ayesha Khan");
    expect(conflictExplanation("Ayesha Khan", "2026-03-12T14:20:00.000Z")).toContain("Ayesha Khan");
  });

  it("PC-003: a pre-feature value says there is no record rather than rendering an empty byline", () => {
    // No migration invents an author. An empty byline reads as a rendering bug, and a
    // guessed one would be a false record.
    expect(provenanceByline(null, null)).toBe(NO_RECORDED_AUTHOR_BYLINE);
    expect(provenanceByline("Ayesha Khan", null)).toBe(NO_RECORDED_AUTHOR_BYLINE);
    expect(provenanceByline(null, "2026-03-12T14:20:00.000Z")).toBe(NO_RECORDED_AUTHOR_BYLINE);
  });

  it("PC-004: formats a time without leaking an ISO string to a reader", () => {
    const formatted = formatSetAt("2026-03-12T14:20:00.000Z");
    expect(formatted).not.toContain("T14:20");
    expect(formatted).not.toContain("Z");
  });

  it("PC-005: a conflict with no recorded author still reads as a sentence", () => {
    const message = conflictExplanation(null, null);
    expect(message).toMatch(/^Someone else changed this while you were editing\./);
    expect(message).not.toMatch(/null|undefined|NaN/);
  });

  it("PC-006: a conflict message says the typed text is kept", () => {
    // The Design Direction names discarding the typed value as the most likely bug in
    // this feature, so the copy commits to not doing it.
    expect(conflictExplanation("Sam", "2026-03-12T14:20:00.000Z")).toMatch(/still here/i);
  });
});

describe("profileCopy — the locked-field sentence (SC-009)", () => {
  it("PC-007: answers both why it is locked and how to get it changed", () => {
    // SC-009 is that an owner can state both, unaided. A sentence answering only the
    // first leaves them stuck, which is what SC-010 exists to prevent.
    expect(LOCKED_FIELD_EXPLANATION).toMatch(/IT staff/);
    expect(LOCKED_FIELD_EXPLANATION).toMatch(/cannot change it here/i);
    expect(LOCKED_FIELD_EXPLANATION).toMatch(/ask IT staff/i);
  });

  it("PC-008: the all-locked page still says what the page is for", () => {
    expect(ALL_FIELDS_LOCKED_EXPLANATION).toMatch(/report a problem/i);
    expect(ALL_FIELDS_LOCKED_EXPLANATION).toMatch(/ask IT staff/i);
  });

  it("PC-009: a save refused by a lock explains what happened rather than dropping the value", () => {
    expect(LOCKED_ON_SAVE_EXPLANATION).toMatch(/not saved/i);
    expect(LOCKED_ON_SAVE_EXPLANATION).toMatch(/shown above/i);
  });

  it("PC-010: owner-facing copy uses no internal vocabulary (NFR-2)", () => {
    const ownerFacing = [
      LOCKED_FIELD_EXPLANATION,
      ALL_FIELDS_LOCKED_EXPLANATION,
      LOCKED_ON_SAVE_EXPLANATION,
      NO_RECORDED_AUTHOR_BYLINE,
      provenanceByline("Ayesha Khan", "2026-03-12T14:20:00.000Z"),
    ];
    for (const sentence of ownerFacing) {
      expect(sentence).not.toMatch(/provenance|authoritative|field control|controlledBy/i);
    }
  });

  it("PC-011: no rendered string carries an em-dash (Design Direction)", () => {
    const rendered = [
      LOCKED_FIELD_EXPLANATION,
      ALL_FIELDS_LOCKED_EXPLANATION,
      LOCKED_ON_SAVE_EXPLANATION,
      NO_RECORDED_AUTHOR_BYLINE,
      OWNER_CONTROLLED_NOTE,
      STAFF_CONTROLLED_NOTE,
      provenanceByline("Ayesha Khan", "2026-03-12T14:20:00.000Z"),
      conflictExplanation("Sam", "2026-03-12T14:20:00.000Z"),
      conflictExplanation(null, null),
    ];
    for (const sentence of rendered) {
      expect(sentence).not.toContain("—");
    }
  });
});

describe("profileCopy — written once, consumed from here", () => {
  it("PC-012: no other source file hardcodes the locked-field sentence or the byline prefix", () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => !path.endsWith("lib/profileCopy.ts"))
      .filter(
        ([, text]) =>
          text.includes("IT staff keep this detail up to date") ||
          text.includes('"Set by ') ||
          text.includes("`Set by "),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
