import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const appModeSchema = z.enum(["development", "test", "demo"]);

export const envSchema = z.object({
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/helpdesk"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_MODE: appModeSchema.default("development"),
  LLM_PROVIDER: z.enum(["ollama", "openai_compat", "mock"]).default("ollama"),
  LLM_MODEL: z.string().min(1).default("llama3.1:8b"),
  OLLAMA_URL: z.string().min(1).default("http://127.0.0.1:11434"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  LLM_API_KEY: z.string().optional(),
  // Parsed with `new URL()` by the openai_compat provider to decide whether a
  // local base URL may skip LLM_API_KEY; validate here so a bad value fails at
  // startup instead of silently degrading to "no API key configured".
  // The protocol check is not redundant with .url(): zod accepts
  // "localhost:1234/v1" as a URL whose protocol is "localhost:" and whose
  // hostname is empty, which is the likeliest way to mistype this variable.
  LLM_BASE_URL: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "must start with http:// or https://",
    })
    .optional(),
  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  MAX_CLARIFICATION_ROUNDS: z.coerce.number().int().min(0).default(2),
  SESSION_INACTIVITY_MINUTES: z.coerce.number().int().positive().default(30),
  AUTH_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(60 * 24 * 7),
  STT_PROVIDERS: z.string().min(1).default("local"),
  STT_MODEL_DIR: z.string().min(1).default("./models/stt"),
  STT_OPENAI_BASE_URL: z.string().optional(),
  STT_OPENAI_API_KEY: z.string().optional(),
  STT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  VOICE_MAX_SECONDS: z.coerce.number().int().positive().default(120),
  MAINTAINER_KEY: z.string().optional(),
});

export type AppMode = z.infer<typeof appModeSchema>;
export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const config = loadConfig();
