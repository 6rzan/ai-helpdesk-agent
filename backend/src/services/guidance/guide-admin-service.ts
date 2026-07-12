import { z } from "zod";
import { Category, type CategoryDoc } from "../../models/category.js";
import { Guide, type GuideDoc } from "../../models/guide.js";
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableEntityError } from "../../lib/errors.js";

export const guideStepBodySchema = z.object({
  instruction: z.string().min(10).max(800),
  successHint: z.string().min(5).max(300),
});

// Deliberately not wired into the shared `validate` middleware (which always
// maps zod failures to 400) — the contract requires empty/invalid steps to be
// a 422, so this is parsed explicitly in the route handler.
export const guideStepsBodySchema = z.array(guideStepBodySchema).min(1).max(20);

function parseSteps(steps: unknown): z.infer<typeof guideStepsBodySchema> {
  const result = guideStepsBodySchema.safeParse(steps);
  if (!result.success) {
    throw new UnprocessableEntityError(
      `Invalid guide steps: ${result.error.issues.map((i) => i.message).join("; ")}`,
      "INVALID_GUIDE_STEPS",
    );
  }
  return result.data;
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
