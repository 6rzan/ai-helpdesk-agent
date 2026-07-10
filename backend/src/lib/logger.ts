import pino, { type LoggerOptions } from "pino";
import { config } from "../config/index.js";

const baseOptions: LoggerOptions = {
  level: config.APP_MODE === "test" ? "silent" : "info",
};

export const logger = pino(
  config.APP_MODE === "development"
    ? { ...baseOptions, transport: { target: "pino-pretty", options: { colorize: true } } }
    : baseOptions,
);

export const auditLogger = pino({
  level: config.APP_MODE === "test" ? "silent" : "info",
  base: { channel: "audit" },
});
