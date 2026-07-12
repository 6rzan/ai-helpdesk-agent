import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { maintainerAuth, type MaintainerRequest } from "../middleware/maintainer-auth.js";
import {
  createCategoryWithGuide,
  listCategoriesWithActiveVersion,
  listGuideVersions,
  publishGuideVersion,
  retireCategory,
  updateCategoryMetadata,
} from "../../services/guidance/guide-admin-service.js";

const nameSlugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z][a-z0-9_]*$/, "name must be a lowercase snake_case slug");

const nameParamsSchema = z.object({ name: z.string().min(1) });

const createCategoryBodySchema = z.object({
  name: nameSlugSchema,
  displayName: z.string().trim().min(1).max(60),
  classificationDescription: z.string().trim().min(10).max(500),
  guide: z.object({
    steps: z.array(z.unknown()),
    changeNote: z.string().max(300).optional(),
  }),
});

const updateCategoryBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    classificationDescription: z.string().trim().min(10).max(500).optional(),
  })
  .refine((body) => body.displayName !== undefined || body.classificationDescription !== undefined, {
    message: "At least one of displayName or classificationDescription is required",
  });

const publishGuideBodySchema = z.object({
  steps: z.array(z.unknown()),
  changeNote: z.string().max(300).optional(),
});

export const adminGuidesRouter = Router();

adminGuidesRouter.use(maintainerAuth);

adminGuidesRouter.get("/categories", (_req, res, next) => {
  listCategoriesWithActiveVersion()
    .then((categories) => res.status(200).json({ categories }))
    .catch(next);
});

adminGuidesRouter.post(
  "/categories",
  validate({ body: createCategoryBodySchema }),
  (req, res, next) => {
    (async () => {
      const body = req.body as z.infer<typeof createCategoryBodySchema>;
      const actor = (req as MaintainerRequest).maintainerName;
      const result = await createCategoryWithGuide(body, actor);
      res.status(201).json(result);
    })().catch(next);
  },
);

adminGuidesRouter.put(
  "/categories/:name",
  validate({ params: nameParamsSchema, body: updateCategoryBodySchema }),
  (req, res, next) => {
    (async () => {
      const { name } = req.params as { name: string };
      const body = req.body as z.infer<typeof updateCategoryBodySchema>;
      const category = await updateCategoryMetadata(name, body);
      res.status(200).json({ category });
    })().catch(next);
  },
);

adminGuidesRouter.delete(
  "/categories/:name",
  validate({ params: nameParamsSchema }),
  (req, res, next) => {
    (async () => {
      const { name } = req.params as { name: string };
      const category = await retireCategory(name);
      res.status(200).json({ category });
    })().catch(next);
  },
);

adminGuidesRouter.post(
  "/categories/:name/guide",
  validate({ params: nameParamsSchema, body: publishGuideBodySchema }),
  (req, res, next) => {
    (async () => {
      const { name } = req.params as { name: string };
      const body = req.body as z.infer<typeof publishGuideBodySchema>;
      const actor = (req as MaintainerRequest).maintainerName;
      const guide = await publishGuideVersion(name, body, actor);
      res.status(201).json({ version: guide.version, active: guide.active });
    })().catch(next);
  },
);

adminGuidesRouter.get(
  "/categories/:name/guide/versions",
  validate({ params: nameParamsSchema }),
  (req, res, next) => {
    (async () => {
      const { name } = req.params as { name: string };
      const versions = await listGuideVersions(name);
      res.status(200).json({
        versions: versions.map((v) => ({
          version: v.version,
          changedBy: v.changedBy,
          changedAt: v.changedAt,
          changeNote: v.changeNote,
          active: v.active,
          steps: v.steps,
        })),
      });
    })().catch(next);
  },
);
