import { Router } from "express";
import { subscribe } from "./event-bus.js";

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
