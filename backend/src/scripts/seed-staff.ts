import { randomBytes } from "node:crypto";
import { connectDb, disconnectDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { UserAccount } from "../models/user-account.js";
import { hashPassword } from "../services/auth/password-service.js";

// R10: no HTTP surface grants the staff role — this maintainer-run script is the
// only way to provision a staff account (FR-002).
function parseArgs(argv: string[]): { email: string; displayName: string } {
  const email = argv[0];
  const displayName = argv[1];
  if (!email || !displayName) {
    throw new Error("Usage: npm run seed:staff -- <email> <displayName>");
  }
  return { email, displayName };
}

function generateInitialPassword(): string {
  return randomBytes(9).toString("base64url");
}

async function seedStaff(): Promise<void> {
  const { email, displayName } = parseArgs(process.argv.slice(2));

  await connectDb();

  const existing = await UserAccount.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.role !== "staff") {
      existing.role = "staff";
      await existing.save();
      logger.info({ email }, "existing account promoted to staff");
    } else {
      logger.info({ email }, "account already exists as staff, no changes made");
    }
    await disconnectDb();
    return;
  }

  const initialPassword = generateInitialPassword();
  const { passwordHash, passwordSalt } = await hashPassword(initialPassword);

  await UserAccount.create({
    email,
    displayName,
    role: "staff",
    passwordHash,
    passwordSalt,
    usingInitialPassword: true,
    availability: "available",
  });

  logger.info({ email, initialPassword }, "staff account created — share the initial password securely");
  await disconnectDb();
}

seedStaff()
  .then(() => {
    logger.info("seed-staff complete");
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, "seed-staff failed");
    process.exit(1);
  });
