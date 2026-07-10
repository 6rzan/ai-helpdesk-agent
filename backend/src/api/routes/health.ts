import { Router } from "express";
import { config } from "../../config/index.js";
import { isDbConnected } from "../../lib/db.js";
import { getLlmProvider } from "../../services/llm/factory.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res, next) => {
  (async () => {
    const dbReachable = isDbConnected();
    let llmReachable = false;
    try {
      llmReachable = await getLlmProvider().health();
    } catch {
      llmReachable = false;
    }

    const status = dbReachable && llmReachable ? "ok" : "degraded";
    res.status(200).json({
      status,
      llm: { reachable: llmReachable, model: config.LLM_MODEL },
      db: { reachable: dbReachable },
    });
  })().catch(next);
});
