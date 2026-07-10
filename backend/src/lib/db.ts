import mongoose from "mongoose";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

let connected = false;

export async function connectDb(uri: string = config.MONGODB_URI): Promise<typeof mongoose> {
  if (connected) {
    return mongoose;
  }
  await mongoose.connect(uri);
  connected = true;
  logger.info({ uri }, "connected to MongoDB");
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  if (!connected) {
    return;
  }
  await mongoose.disconnect();
  connected = false;
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
