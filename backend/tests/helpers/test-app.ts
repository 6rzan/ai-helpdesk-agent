import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { connectDb, disconnectDb } from "../../src/lib/db.js";
import { getLlmProvider, resetLlmProviderCache } from "../../src/services/llm/factory.js";
import type { MockLlmProvider } from "../../src/services/llm/mock-provider.js";

let mongod: MongoMemoryServer | undefined;

export interface TestContext {
  app: Express;
  llm: MockLlmProvider;
}

export async function startTestApp(): Promise<TestContext> {
  mongod ??= await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  resetLlmProviderCache();
  const llm = getLlmProvider() as MockLlmProvider;
  const app = createApp();
  return { app, llm };
}

export async function resetDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function stopTestApp(): Promise<void> {
  await disconnectDb();
  if (mongod) {
    await mongod.stop();
    mongod = undefined;
  }
}
