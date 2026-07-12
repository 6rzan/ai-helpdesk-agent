import express, { type Express, type Request } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./api/middleware/error-handler.js";
import { conversationsRouter } from "./api/routes/conversations.js";
import { eventsRouter } from "./api/sse/events-route.js";
import { healthRouter } from "./api/routes/health.js";
import { sessionsRouter } from "./api/routes/sessions.js";
import { testSupportRouter } from "./api/routes/test-support.js";
import { ticketsRouter } from "./api/routes/tickets.js";
import { transcriptionsRouter } from "./api/routes/transcriptions.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req: Request) => req.url === "/api/health" },
    }),
  );

  app.use("/api", healthRouter);
  app.use("/api", eventsRouter);
  app.use("/api", sessionsRouter);
  app.use("/api", conversationsRouter);
  app.use("/api", ticketsRouter);
  app.use("/api", transcriptionsRouter);
  if (config.APP_MODE === "demo" || config.APP_MODE === "test") {
    app.use("/api", testSupportRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
