import { z } from "zod";
import { ACTION_TIERS } from "../models/enums.js";

// Zod schemas for the two committed, startup-validated policy files
// (data-model.md §1 "Action Policy Entry", §2 "Test Endpoint"). Matching is
// exact per Principle II: no fuzzy, prefix, or nearest-neighbour acceptance
// anywhere in this module.

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

export const argumentSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    name: z.string().min(1),
    kind: z.literal("enum"),
    values: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    name: z.string().min(1),
    kind: z.literal("pattern"),
    pattern: z.string().min(1),
  }),
]);
export type ArgumentSpec = z.infer<typeof argumentSpecSchema>;

function extractPlaceholders(command: string): Set<string> {
  const names = new Set<string>();
  for (const match of command.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1];
    if (name) {
      names.add(name);
    }
  }
  return names;
}

export const actionPolicyEntrySchema = z
  .object({
    id: z.string().regex(KEBAB_CASE, "id must be kebab-case"),
    description: z.string().min(1),
    category: z.string().nullable(),
    guidedStepRef: z.string().nullable(),
    tier: z.enum(ACTION_TIERS),
    command: z.string().min(1),
    arguments: z.array(argumentSpecSchema),
    allowedEndpointIds: z.array(z.string().min(1)).min(1),
    verifiedBy: z.string().nullable(),
    timeoutMs: z.number().int().positive().nullable(),
  })
  .superRefine((entry, ctx) => {
    const placeholders = extractPlaceholders(entry.command);
    const argNames = new Set(entry.arguments.map((a) => a.name));

    for (const placeholder of placeholders) {
      if (!argNames.has(placeholder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `command placeholder {{${placeholder}}} has no matching ArgumentSpec`,
          path: ["command"],
        });
      }
    }
    for (const name of argNames) {
      if (!placeholders.has(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ArgumentSpec "${name}" has no matching command placeholder`,
          path: ["arguments"],
        });
      }
    }
  });
export type ActionPolicyEntry = z.infer<typeof actionPolicyEntrySchema>;

export const actionPolicyFileSchema = z
  .object({
    version: z.string().min(1),
    entries: z.array(actionPolicyEntrySchema),
  })
  .superRefine((file, ctx) => {
    const seenIds = new Set<string>();
    for (const [index, entry] of file.entries.entries()) {
      if (seenIds.has(entry.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate policy entry id "${entry.id}"`,
          path: ["entries", index, "id"],
        });
      }
      seenIds.add(entry.id);
    }

    const readOnlyIds = new Set(file.entries.filter((e) => e.tier === "read_only").map((e) => e.id));
    for (const [index, entry] of file.entries.entries()) {
      if (entry.tier === "state_changing" && entry.verifiedBy !== null && !readOnlyIds.has(entry.verifiedBy)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `verifiedBy "${entry.verifiedBy}" on "${entry.id}" is not a read_only entry in this file`,
          path: ["entries", index, "verifiedBy"],
        });
      }
    }
  });
export type ActionPolicyFile = z.infer<typeof actionPolicyFileSchema>;

export const testEndpointSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  username: z.string().min(1),
  hostKeyFingerprint: z.string().min(1),
  description: z.string().min(1),
});
export type TestEndpoint = z.infer<typeof testEndpointSchema>;

export const endpointRegistryFileSchema = z
  .object({
    entries: z.array(testEndpointSchema),
  })
  .superRefine((file, ctx) => {
    const seenIds = new Set<string>();
    for (const [index, entry] of file.entries.entries()) {
      if (seenIds.has(entry.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate endpoint id "${entry.id}"`,
          path: ["entries", index, "id"],
        });
      }
      seenIds.add(entry.id);
    }
  });
export type EndpointRegistryFile = z.infer<typeof endpointRegistryFileSchema>;

/**
 * Cross-file check that zod's per-file validation cannot express alone: every
 * `allowedEndpointIds` value in the policy must name a real registry entry
 * (data-model.md §1). Returns a list of human-readable issues; empty means valid.
 */
export function validatePolicyAgainstRegistry(policy: ActionPolicyFile, registry: EndpointRegistryFile): string[] {
  const knownEndpointIds = new Set(registry.entries.map((e) => e.id));
  const issues: string[] = [];
  for (const entry of policy.entries) {
    for (const endpointId of entry.allowedEndpointIds) {
      if (!knownEndpointIds.has(endpointId)) {
        issues.push(`policy entry "${entry.id}" names unregistered endpoint id "${endpointId}"`);
      }
    }
  }
  return issues;
}
