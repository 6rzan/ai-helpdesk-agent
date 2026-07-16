import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { connectDb, disconnectDb } from "../../src/lib/db.js";
import { getLlmProvider, resetLlmProviderCache } from "../../src/services/llm/factory.js";
import type { MockLlmProvider } from "../../src/services/llm/mock-provider.js";
import { Category } from "../../src/models/category.js";
import { Guide } from "../../src/models/guide.js";
import { MANDATED_CATEGORIES } from "../../src/models/enums.js";

let mongod: MongoMemoryServer | MongoMemoryReplSet | undefined;

export interface TestContext {
  app: Express;
  llm: MockLlmProvider;
  mongoUri: string;
}

// R2: classification validates the LLM's category against this live collection,
// so integration tests need it seeded — mirrors backend/src/scripts/seed-guides.ts.
async function seedTestCategories(): Promise<void> {
  await Category.insertMany(
    MANDATED_CATEGORIES.map((name) => ({
      name,
      displayName: name,
      classificationDescription: `Test seed description for ${name}`,
      mandated: true,
      retired: false,
      createdBy: "test-app",
      createdAt: new Date(),
    })),
  );
}

// FR-001: guided troubleshooting begins immediately once a ticket is created, so
// every mandated category needs an active guide or pre-existing tests that assert
// automated handling would instead see an immediate FR-012 escalation.
async function seedTestGuides(): Promise<void> {
  await Guide.insertMany(
    MANDATED_CATEGORIES.map((name) => ({
      categoryName: name,
      version: 1,
      steps: [
        {
          instruction: `Test seed step 1 for ${name}: restart the affected device or application.`,
          successHint: "The issue no longer occurs.",
        },
      ],
      active: true,
      changedBy: "test-app",
      changedAt: new Date(),
      changeNote: null,
    })),
  );
}

export async function startTestApp(options: { transactions?: boolean } = {}): Promise<TestContext> {
  if (!mongod) {
    mongod = options.transactions
      ? await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60_000 }] })
      : await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  }
  const mongoUri = mongod.getUri();
  await connectDb(mongoUri);
  resetLlmProviderCache();
  const llm = getLlmProvider() as MockLlmProvider;
  const app = createApp();
  // Existing pre-account journey tests exercise the legacy data migration path;
  // production apps never set this flag, so anonymous session creation stays blocked.
  app.locals.allowLegacySessions = true;
  await seedTestCategories();
  await seedTestGuides();
  return { app, llm, mongoUri };
}

export async function resetDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  await seedTestCategories();
  await seedTestGuides();
}

export async function stopTestApp(): Promise<void> {
  await disconnectDb();
  if (mongod) {
    await mongod.stop();
    mongod = undefined;
  }
}
