import { Router } from "express";
import { subscribe, subscribeAccount, subscribeStaff } from "./event-bus.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireStaff } from "../middleware/require-staff.js";

export const eventsRouter = Router();

const HEARTBEAT_INTERVAL_MS = 20_000;

eventsRouter.get("/events", (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    res.status(400).json({ error: { code: "MISSING_SESSION_ID", message: "sessionId query param is required" } });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const lastEventId = req.header("Last-Event-ID");

  const unsubscribe = subscribe(sessionId, lastEventId, (event) => {
    res.write(`id: ${event.id}\n`);
    res.write(`event: ${event.name}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// Staff dashboard stream — a single broadcast channel behind requireStaff so the
// ticket list refreshes live without a reload (contracts/api.md, US1-6).
eventsRouter.get("/staff/events", requireAuth, requireStaff, (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const unsubscribe = subscribeStaff((event) => {
    res.write(`id: ${event.id}\n`);
    res.write(`event: ${event.name}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

eventsRouter.get("/my/events", requireAuth, (req, res) => {
  res.status(200).setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache"); res.setHeader("Connection", "keep-alive"); res.flushHeaders();
  const unsubscribe = subscribeAccount(String(req.account!._id), req.header("Last-Event-ID"), (event) => {
    res.write(`id: ${event.id}\nevent: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(":heartbeat\n\n"), HEARTBEAT_INTERVAL_MS);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});
