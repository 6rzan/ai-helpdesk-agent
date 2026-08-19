import { z } from "zod";

// Shared per-argument zod schemas for the read-only tools (contracts/tools.md
// "Arguments are enums or anchored patterns, never free text"). Model output is
// untrusted input (Principle VIII): a tool call whose arguments fail this schema
// is refused before any policy match is attempted (FR-006).

export const testAccountUsernameSchema = z.enum(["test-user-locked", "test-user-active"]);

export const networkProbeTargetSchema = z.enum(["test-node-a", "test-node-b", "1.1.1.1"]);

export const approvedServiceNameSchema = z.enum(["widget-service"]);

export const endpointIdSchema = z.enum(["test-node-a", "test-node-b"]);
