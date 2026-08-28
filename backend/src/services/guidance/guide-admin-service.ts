import { z } from "zod";
import { Category, type CategoryDoc } from "../../models/category.js";
import { Guide, type GuideDoc } from "../../models/guide.js";
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnprocessableEntityError } from "../../lib/errors.js";

export const guideStepBodySchema = z.object({
  instruction: z.string().min(10).max(800),
  successHint: z.string().min(5).max(300),
});

export const MIN_GUIDE_STEPS = 1;
export const MAX_GUIDE_STEPS = 20;

// Deliberately not wired into the shared `validate` middleware (which always
// maps zod failures to 400) — the contract requires empty/invalid steps to be
// a 422, so this is parsed explicitly in the route handler.
export const guideStepsBodySchema = z
  .array(guideStepBodySchema)
  .min(MIN_GUIDE_STEPS)
  .max(MAX_GUIDE_STEPS);

/**
 * A guide rejected because one specific step is wrong (007 FR-013, T016).
 *
 * Carries `stepIndex` and `field` in `details`, which the error handler merges into the
 * top level of the response body. That is what lets the editor put the message on the
 * step the maintainer is actually looking at, rather than showing "the guide is
 * invalid" above a list of twenty steps and leaving them to find which one.
 */
export class GuideStepInvalidError extends AppError {
  constructor(message: string, stepIndex: number, field: string) {
    super(400, "GUIDE_STEP_INVALID", message, { stepIndex, field });
    this.name = "GuideStepInvalidError";
  }
}

/**
 * Plain-language messages for the four ways a single step can be wrong (NFR-2). Written
 * out rather than derived from zod's issue text, because "String must contain at least
 * 10 character(s)" is not a sentence to put in front of a maintainer.
 */
function stepFieldMessage(
  field: "instruction" | "successHint",
  humanStepNumber: number,
  reason: "missing" | "tooShort" | "tooLong",
): string {
  const label = field === "instruction" ? "an instruction" : "a success hint";
  switch (reason) {
    case "missing":
      return `Step ${humanStepNumber} needs ${label}.`;
    case "tooShort":
      return `Step ${humanStepNumber} needs a longer ${field === "instruction" ? "instruction" : "success hint"}.`;
    case "tooLong":
      return `Step ${humanStepNumber} has ${field === "instruction" ? "an instruction" : "a success hint"} that is too long.`;
  }
}

/**
 * Validate the guide's steps.
 *
 * Two kinds of failure, deliberately kept apart:
 *
 *   1. **Count-level** — not an array, no steps at all, or more than the maximum. These
 *      keep the `422 INVALID_GUIDE_STEPS` that feature 003 shipped and that 003's
 *      quickstart evidence records. There is no offending step to point at in a guide
 *      with zero steps, so FR-013's "identify the step and field" has nothing to say
 *      here, and changing the status would invalidate recorded evidence for no gain.
 *   2. **Step-level** — one step is missing or malforms a field. New in 007: a
 *      `400 GUIDE_STEP_INVALID` carrying the zero-based `stepIndex` and the `field`
 *      name, so the editor can place the error inline (FR-013, research.md R12).
 *
 * The first offending step is reported rather than all of them: the editor puts the
 * message on one step, and a maintainer fixing one error at a time gets a fresh answer
 * on each save.
 */
function parseSteps(steps: unknown): z.infer<typeof guideStepsBodySchema> {
  if (!Array.isArray(steps) || steps.length < MIN_GUIDE_STEPS || steps.length > MAX_GUIDE_STEPS) {
    const result = guideStepsBodySchema.safeParse(steps);
    throw new UnprocessableEntityError(
      result.success
        ? "Invalid guide steps"
        : `Invalid guide steps: ${result.error.issues.map((i) => i.message).join("; ")}`,
      "INVALID_GUIDE_STEPS",
    );
  }

  steps.forEach((step, index) => {
    const humanStepNumber = index + 1;
    const record = (step ?? {}) as Record<string, unknown>;

    for (const field of ["instruction", "successHint"] as const) {
      const value = record[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new GuideStepInvalidError(
          stepFieldMessage(field, humanStepNumber, "missing"),
          index,
          field,
        );
      }
    }

    const parsed = guideStepBodySchema.safeParse(step);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      const field = (issue.path[0] as "instruction" | "successHint" | undefined) ?? "instruction";
      const reason = issue.code === "too_big" ? "tooLong" : "tooShort";
      throw new GuideStepInvalidError(
        stepFieldMessage(field, humanStepNumber, reason),
        index,
        field,
      );
    }
  });

  return guideStepsBodySchema.parse(steps);
}

export interface CategoryWithActiveVersion {
  name: string;
  displayName: string;
  classificationDescription: string;
  mandated: boolean;
  retired: boolean;
  activeGuideVersion: number | null;
}

export async function listCategoriesWithActiveVersion(): Promise<CategoryWithActiveVersion[]> {
  const categories = await Category.find({}).sort({ name: 1 }).lean();
  const results: CategoryWithActiveVersion[] = [];
  for (const category of categories) {
    const activeGuide = await Guide.findOne({ categoryName: category.name, active: true }).lean();
    results.push({
      name: category.name,
      displayName: category.displayName,
      classificationDescription: category.classificationDescription,
      mandated: category.mandated,
      retired: category.retired,
      activeGuideVersion: activeGuide?.version ?? null,
    });
  }
  return results;
}

export interface CreateCategoryInput {
  name: string;
  displayName: string;
  classificationDescription: string;
  guide: { steps: unknown; changeNote?: string | undefined };
}

export async function createCategoryWithGuide(
  input: CreateCategoryInput,
  actor: string,
): Promise<{ category: CategoryDoc; guide: GuideDoc }> {
  const steps = parseSteps(input.guide.steps);

  const existing = await Category.findOne({ name: input.name });
  if (existing) {
    throw new ConflictError(`Category "${input.name}" already exists`, "CATEGORY_ALREADY_EXISTS");
  }

  const category = await Category.create({
    name: input.name,
    displayName: input.displayName,
    classificationDescription: input.classificationDescription,
    mandated: false,
    retired: false,
    createdBy: actor,
    createdAt: new Date(),
  });

  const guide = await Guide.create({
    categoryName: input.name,
    version: 1,
    steps,
    active: true,
    changedBy: actor,
    changedAt: new Date(),
    changeNote: input.guide.changeNote ?? "Initial guide",
  });

  return { category: category.toObject() as CategoryDoc, guide: guide.toObject() as GuideDoc };
}

export interface UpdateCategoryInput {
  displayName?: string | undefined;
  classificationDescription?: string | undefined;
}

export async function updateCategoryMetadata(
  name: string,
  input: UpdateCategoryInput,
): Promise<CategoryDoc> {
  const category = await Category.findOne({ name });
  if (!category) {
    throw new NotFoundError(`Unknown category "${name}"`, "CATEGORY_NOT_FOUND");
  }
  if (input.displayName !== undefined) {
    category.displayName = input.displayName;
  }
  if (input.classificationDescription !== undefined) {
    category.classificationDescription = input.classificationDescription;
  }
  await category.save();
  return category.toObject() as CategoryDoc;
}

export async function retireCategory(name: string): Promise<CategoryDoc> {
  const category = await Category.findOne({ name });
  if (!category) {
    throw new NotFoundError(`Unknown category "${name}"`, "CATEGORY_NOT_FOUND");
  }
  if (category.mandated) {
    throw new ForbiddenError(
      `Category "${name}" is one of the mandated six and cannot be deleted`,
      "MANDATED_CATEGORY_UNDELETABLE",
    );
  }
  category.retired = true;
  await category.save();
  return category.toObject() as CategoryDoc;
}

export interface PublishGuideInput {
  steps: unknown;
  changeNote?: string | undefined;
}

// FR-017: the previous active version is flipped off before the new one is
// inserted, and in-flight GuidedSession docs keep their already-pinned
// (categoryName, guideVersion) pair — nothing here ever mutates an old version.
export async function publishGuideVersion(
  categoryName: string,
  input: PublishGuideInput,
  actor: string,
): Promise<GuideDoc> {
  const category = await Category.findOne({ name: categoryName });
  if (!category) {
    throw new NotFoundError(`Unknown category "${categoryName}"`, "CATEGORY_NOT_FOUND");
  }
  const steps = parseSteps(input.steps);

  const latest = await Guide.findOne({ categoryName }).sort({ version: -1 });
  const nextVersion = (latest?.version ?? 0) + 1;

  await Guide.updateMany({ categoryName, active: true }, { $set: { active: false } });

  const guide = await Guide.create({
    categoryName,
    version: nextVersion,
    steps,
    active: true,
    changedBy: actor,
    changedAt: new Date(),
    changeNote: input.changeNote ?? null,
  });

  return guide.toObject() as GuideDoc;
}

export async function listGuideVersions(categoryName: string): Promise<GuideDoc[]> {
  const category = await Category.findOne({ name: categoryName });
  if (!category) {
    throw new NotFoundError(`Unknown category "${categoryName}"`, "CATEGORY_NOT_FOUND");
  }
  const guides = await Guide.find({ categoryName }).sort({ version: 1 }).lean();
  return guides as unknown as GuideDoc[];
}
