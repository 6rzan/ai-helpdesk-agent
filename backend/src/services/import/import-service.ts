import ExcelJS from "exceljs";
import crypto from "node:crypto";
import { Types, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { ProfileImport, IMPORT_FIELDS, type ImportField, type ImportMapping, type ImportOutcome, type ProfileImportDoc } from "../../models/profile-import.js";
import { UserAccount } from "../../models/user-account.js";
import { SupportProfile } from "../../models/support-profile.js";
import { hashPassword } from "../auth/password-service.js";
import { ValidationError, NotFoundError, ConflictError } from "../../lib/errors.js";

export { IMPORT_FIELDS };
export type { ImportField, ImportMapping, ImportOutcome };

const importIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid import ID");
const mappingSchema = z.record(z.enum(IMPORT_FIELDS));
const rowSchema = z.array(z.string());
const emailSchema = z.string().email();
const outcomeSchema = z.object({
  row: z.number().int().positive(),
  email: z.string(),
  outcome: z.enum(["created", "updated", "rejected"]),
  reason: z.string().optional(),
  initialPassword: z.string().optional(),
});
type ImportDocument = HydratedDocument<ProfileImportDoc>;

function validateId(id: string): Types.ObjectId {
  return new Types.ObjectId(importIdSchema.parse(id));
}

function mappingObject(doc: ImportDocument): ImportMapping {
  const mapping = doc.mapping as ImportMapping & { toObject?: () => Record<string, ImportField> };
  return mapping.toObject ? mapping.toObject() : Object.fromEntries(mapping instanceof Map ? mapping.entries() : Object.entries(mapping));
}

function mappedValue(doc: ImportDocument, row: string[], field: ImportField): string {
  const mapping = mappingObject(doc);
  const column = Object.entries(mapping).find(([, value]) => value === field)?.[0];
  return column === undefined ? "" : row[doc.columns.indexOf(column)]?.trim() ?? "";
}

function materializeOutcomes(doc: ImportDocument): ImportOutcome[] {
  return doc.rowOutcomes.map((outcome) => {
    const value = typeof (outcome as unknown as { toObject?: () => unknown }).toObject === "function"
      ? (outcome as unknown as { toObject: () => unknown }).toObject()
      : outcome;
    const parsed = outcomeSchema.parse(value);
    return {
      row: parsed.row,
      email: parsed.email,
      outcome: parsed.outcome,
      ...(parsed.reason === undefined ? {} : { reason: parsed.reason }),
      ...(parsed.initialPassword === undefined ? {} : { initialPassword: parsed.initialPassword }),
    };
  });
}

export async function parseImport(buffer: Buffer, filename: string, staff: { _id: Types.ObjectId; displayName: string }) {
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(Uint8Array.from(buffer).buffer);
  } catch {
    throw new ValidationError("The uploaded file is not a readable .xlsx workbook.");
  }
  const sheet = book.worksheets[0];
  if (!sheet) throw new ValidationError("The workbook has no worksheet.");
  const values: string[][] = [];
  sheet.eachRow((row) => values.push((row.values as unknown[]).slice(1).map((value) => String(value ?? "").trim())));
  const [columns, ...rows] = values;
  if (!columns || values.length < 2 || values.length > 1001 || columns.some((column) => !column)) {
    throw new ValidationError("The workbook must contain a header and between 1 and 1000 data rows.");
  }
  const doc = await ProfileImport.create({ staffId: staff._id, staffName: staff.displayName, filename: z.string().min(1).max(255).parse(filename), columns, rows });
  return { importId: String(doc._id), columns: doc.columns, sampleRows: doc.rows.slice(0, 5) };
}

export async function setMapping(id: string, input: unknown) {
  const mapping = mappingSchema.parse(input);
  const importId = validateId(id);
  if (!Object.values(mapping).includes("email")) throw new ValidationError("Map one column to email before continuing.");
  const doc = await ProfileImport.findOneAndUpdate(
    { _id: importId, status: { $in: ["mapping", "previewed"] } },
    { $set: { mapping, status: "mapping", rowOutcomes: [] } },
    { new: true },
  );
  if (!doc) throw new ConflictError("Applied or missing imports cannot be re-mapped.");
  return doc;
}

function previewOutcome(doc: ImportDocument, row: string[], rowNumber: number, seen: Set<string>, existingEmails: Set<string>): ImportOutcome {
  const email = mappedValue(doc, row, "email").toLowerCase();
  const displayName = mappedValue(doc, row, "displayName");
  const suppliedPassword = mappedValue(doc, row, "initialPassword");
  const base = { row: rowNumber, email };
  if (!emailSchema.safeParse(email).success) return { ...base, outcome: "rejected", reason: "A valid email is required." };
  if (seen.has(email)) return { ...base, outcome: "rejected", reason: "Duplicate email in this file." };
  seen.add(email);
  if (suppliedPassword && suppliedPassword.length < 8) return { ...base, outcome: "rejected", reason: "Initial passwords must be at least 8 characters." };
  if (!existingEmails.has(email) && !displayName) return { ...base, outcome: "rejected", reason: "Display name is required for new accounts." };
  return { ...base, outcome: existingEmails.has(email) ? "updated" : "created" };
}

export async function preview(id: string) {
  const importId = validateId(id);
  const doc = await ProfileImport.findById(importId);
  if (!doc) throw new NotFoundError("Import not found.");
  const mapping = mappingObject(doc);
  if (!Object.values(mapping).includes("email")) throw new ValidationError("Map one column to email before previewing.");
  const rows = doc.rows.map((row) => rowSchema.parse(row));
  const emails = rows.map((row) => mappedValue(doc, row, "email").toLowerCase()).filter((email) => emailSchema.safeParse(email).success);
  const accounts = await UserAccount.find({ email: { $in: emails } }).select("email");
  const existingEmails = new Set(accounts.map((account) => account.email));
  const seen = new Set<string>();
  const outcomes = rows.map((row, index) => previewOutcome(doc, row, index + 2, seen, existingEmails));
  const updated = await ProfileImport.findOneAndUpdate({ _id: importId, status: { $in: ["mapping", "previewed"] } }, { $set: { rowOutcomes: outcomes, status: "previewed" } }, { new: true });
  if (!updated) throw new ConflictError("Applied imports cannot be previewed again.");
  return { importId: id, outcomes };
}

export async function applyImport(id: string) {
  const importId = validateId(id);
  const lock = await ProfileImport.findOneAndUpdate(
    { _id: importId, status: "previewed", appliedAt: { $exists: false } },
    { $set: { appliedAt: new Date() } },
    { new: true },
  );
  if (!lock) {
    const existing = await ProfileImport.findById(importId).select("+rowOutcomes.initialPassword");
    if (!existing) throw new NotFoundError("Import not found.");
    if (existing.status === "applied") return { importId: id, outcomes: materializeOutcomes(existing) };
    throw new ConflictError("This import is already being applied or must be previewed first.");
  }
  // Mongoose subdocuments do not expose schema fields through object spread. Materialize
  // them before branching so rejected rows retain their outcome and are never applied.
  const outcomes = materializeOutcomes(lock);
  for (const [rowIndex, outcome] of outcomes.entries()) {
    if (outcome.outcome === "rejected") continue;
    const row = rowSchema.parse(lock.rows[rowIndex]);
    const email = mappedValue(lock, row, "email").toLowerCase();
    let account = await UserAccount.findOne({ email }).select("+passwordHash +passwordSalt");
    if (!account) {
      const suppliedPassword = mappedValue(lock, row, "initialPassword");
      const password = suppliedPassword || `Temp-${crypto.randomBytes(5).toString("hex")}`;
      const hash = await hashPassword(password);
      account = await UserAccount.create({ email, displayName: mappedValue(lock, row, "displayName"), passwordHash: hash.passwordHash, passwordSalt: hash.passwordSalt, usingInitialPassword: true });
      outcome.initialPassword = password;
    } else if (mappedValue(lock, row, "displayName")) {
      account.displayName = mappedValue(lock, row, "displayName");
      await account.save();
    }
    const profileSet: Record<string, unknown> = {};
    for (const field of ["location", "hardware"] as const) {
      const value = mappedValue(lock, row, field);
      if (value) profileSet[field] = value;
    }
    const remoteAccessId = mappedValue(lock, row, "remoteAccessId");
    const update: Record<string, unknown> = { $setOnInsert: { accountId: account._id, remoteAccessIds: [], staffEntries: [] } };
    if (Object.keys(profileSet).length) update.$set = profileSet;
    if (remoteAccessId) update.$addToSet = { remoteAccessIds: { tool: "Imported", id: remoteAccessId } };
    await SupportProfile.findOneAndUpdate({ accountId: account._id }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  await ProfileImport.findByIdAndUpdate(importId, { $set: { status: "applied", rowOutcomes: outcomes } });
  // Return the materialized working report so the staff UI receives generated
  // credentials immediately; retry responses explicitly select the stored values above.
  return { importId: id, outcomes };
}
