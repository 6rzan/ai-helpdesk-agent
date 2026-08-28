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
import { maintainerStatusRouter } from "./api/routes/maintainer-status.js";
import { sessionsRouter } from "./api/routes/sessions.js";
import { myRouter } from "./api/routes/my.js";
import { staffActionsRouter } from "./api/routes/staff-actions.js";
import { staffApprovalsRouter } from "./api/routes/staff-approvals.js";
import { staffRemediationRouter } from "./api/routes/staff-remediation.js";
import { staffRosterRouter } from "./api/routes/staff-roster.js";
import { staffTicketsRouter } from "./api/routes/staff-tickets.js";
import { staffUsersRouter } from "./api/routes/staff-users.js";
import { staffAccountsRouter } from "./api/routes/staff-accounts.js";
import { staffImportsRouter } from "./api/routes/staff-imports.js";
import { staffMetricsRouter } from "./api/routes/staff-metrics.js";
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
  app.use("/api", myRouter);
  app.use("/api", conversationsRouter);
  app.use("/api", ticketsRouter);
  app.use("/api", staffTicketsRouter);
  app.use("/api", staffApprovalsRouter);
  app.use("/api", staffActionsRouter);
  app.use("/api", staffRemediationRouter);
  app.use("/api", staffMetricsRouter);
  app.use("/api", staffUsersRouter);
  app.use("/api", staffAccountsRouter);
  app.use("/api", staffImportsRouter);
  app.use("/api", staffRosterRouter);
  app.use("/api", transcriptionsRouter);
  // Mounted unconditionally, and deliberately outside the MAINTAINER_KEY guard below:
  // the probe's entire job is to answer while administration is switched off, so a
  // conditional mount would make it 404 in exactly the case it exists for (FR-005).
  app.use("/api", maintainerStatusRouter);
  if (config.APP_MODE === "demo" || config.APP_MODE === "test") {
    app.use("/api", testSupportRouter);
  }
  // Routes absent entirely (not just guarded) when no key is configured (contracts/api.md).
  // Mounted at /api/maintainer (not /api) so its blanket maintainerAuth middleware
  // never intercepts unrelated /api/* traffic like /api/tickets/...
  //
  // 007 T015: the namespace moved from /api/admin to /api/maintainer. The constitution
  // states there is no admin role and no third role (Principle III), and a path called
  // /admin invites exactly the reading the maintainer is not — an account with elevated
  // rights, rather than a shared-secret header on a different axis (research.md R1).
  // The /maintainer/status probe above sits in the same namespace but outside this
  // guard, which is why the two mounts are separate.
  if (config.MAINTAINER_KEY) {
    app.use("/api/maintainer", adminGuidesRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
