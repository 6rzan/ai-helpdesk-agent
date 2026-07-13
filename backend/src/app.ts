import express, { type Express, type Request } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./api/middleware/error-handler.js";
import { adminGuidesRouter } from "./api/routes/admin-guides.js";
import { authRouter } from "./api/routes/auth.js";
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
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req: Request) => req.url === "/api/health" },
    }),
  );

  app.use("/api", healthRouter);
  app.use("/api", authRouter);
  app.use("/api", eventsRouter);
  app.use("/api", sessionsRouter);
  app.use("/api", conversationsRouter);
  app.use("/api", ticketsRouter);
  app.use("/api", transcriptionsRouter);
  if (config.APP_MODE === "demo" || config.APP_MODE === "test") {
    app.use("/api", testSupportRouter);
  }
  // Routes absent entirely (not just guarded) when no key is configured (contracts/api.md).
  // Mounted at /api/admin (not /api) so its blanket maintainerAuth middleware
  // never intercepts unrelated /api/* traffic like /api/tickets/...
  if (config.MAINTAINER_KEY) {
    app.use("/api/admin", adminGuidesRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
