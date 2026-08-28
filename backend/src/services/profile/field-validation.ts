import { z } from "zod";
import { ValidationError } from "../../lib/errors.js";
import { PROFILE_FIELDS, type ProfileField } from "../../models/enums.js";
import type { ProfileFieldValue } from "./profile-field-service.js";

/**
 * Boundary validation for the three support fields (007 T032, T033).
 *
 * Shared by the staff route and the owner route so the two cannot drift: a limit the
 * owner is held to and staff are not would let staff write a value the owner's own page
 * then refuses to save back.
 *
 * The limits themselves are the ones `my.ts` has always enforced. This module does not
 * tighten or loosen them; it gives them one definition and one set of error shapes.
 */

export const FIELD_LIMITS = {
  location: 160,
  hardware: 500,
  remoteAccessTool: 80,
  remoteAccessId: 160,
  remoteAccessEntries: 10,
} as const;

export const remoteAccessEntrySchema = z.object({
  tool: z.string().trim().max(FIELD_LIMITS.remoteAccessTool),
  id: z.string().trim().max(FIELD_LIMITS.remoteAccessId),
});

export const remoteAccessListSchema = z
  .array(remoteAccessEntrySchema)
  .max(FIELD_LIMITS.remoteAccessEntries);

export const locationSchema = z.string().trim().max(FIELD_LIMITS.location);
export const hardwareSchema = z.string().trim().max(FIELD_LIMITS.hardware);

export function isProfileField(name: string): name is ProfileField {
  return (PROFILE_FIELDS as readonly string[]).includes(name);
}

/**
 * Rejects a half-filled remote access entry, naming which one.
 *
 * A tool with no id is not a usable way to reach a machine, and a bare id does not say
 * what to connect with. Storing either would put a value in front of staff during an
 * escalation that looks like a contact route and is not one.
 *
 * Reported with `entryIndex` because the list is one field: without the index the person
 * editing a list of six has to work out which row the message is about.
 */
export function assertRemoteAccessEntries(entries: { tool: string; id: string }[]): void {
  entries.forEach((entry, entryIndex) => {
    const hasTool = entry.tool.trim().length > 0;
    const hasId = entry.id.trim().length > 0;
    if (hasTool !== hasId) {
      throw new ValidationError(
        hasTool
          ? "This remote access entry names a tool but no ID"
          : "This remote access entry has an ID but does not say which tool it is for",
        "REMOTE_ACCESS_ENTRY_INVALID",
        { entryIndex },
      );
    }
  });
}

/** Validates one field's submitted value against that field's own rules. */
export function parseFieldValue(field: ProfileField, value: unknown): ProfileFieldValue {
  if (field === "remoteAccessIds") {
    const parsed = remoteAccessListSchema.safeParse(value);
    if (!parsed.success) {
      throw new ValidationError(
        `The remote access list is not valid for ${field}`,
        "VALIDATION_ERROR",
        { field },
      );
    }
    assertRemoteAccessEntries(parsed.data);
    // A wholly empty row is the editor's blank line, not a value the person meant to add.
    return parsed.data.filter((entry) => entry.tool.trim() && entry.id.trim());
  }

  const schema = field === "location" ? locationSchema : hardwareSchema;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(`The value submitted for ${field} is not valid`, "VALIDATION_ERROR", {
      field,
    });
  }
  return parsed.data;
}
