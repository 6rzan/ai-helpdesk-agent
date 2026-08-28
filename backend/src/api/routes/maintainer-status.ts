import { Router } from "express";
import { config } from "../../config/index.js";

/**
 * `GET /api/maintainer/status` — is maintainer administration switched on?
 *
 * Unauthenticated and **always mounted**, including when `MAINTAINER_KEY` is unset.
 * That is the whole point of it (FR-005, research.md R2): every other maintainer route
 * is absent when the key is unset, so without this probe the console could not tell
 * "administration is off" apart from "wrong URL" — it would render a sign-in form,
 * take a key, and fail with a 404 that means nothing to the person reading it.
 *
 * The body is one boolean and nothing else. No key, no key length, no version, no
 * counts: anything more would either narrow the key or describe the deployment to an
 * unauthenticated caller. `config.MAINTAINER_KEY` is read per request rather than
 * captured at mount time so the answer always reflects the running configuration.
 *
 * There is no error response. `200` always.
 */
export const maintainerStatusRouter = Router();

maintainerStatusRouter.get("/maintainer/status", (_req, res) => {
  res.status(200).json({ enabled: Boolean(config.MAINTAINER_KEY) });
});
