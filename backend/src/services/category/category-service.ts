import { Category, type CategoryDoc } from "../../models/category.js";
import { UNCLASSIFIED_CATEGORY } from "../../models/enums.js";

export interface ClassificationCategoryOption {
  name: string;
  classificationDescription: string;
}

// R2: assembled at runtime so new categories classify without a code change.
export async function listClassificationCategories(): Promise<ClassificationCategoryOption[]> {
  const categories = await Category.find({ retired: false }).sort({ name: 1 }).lean();
  return categories.map((c) => ({ name: c.name, classificationDescription: c.classificationDescription }));
}

export async function isKnownCategory(name: string): Promise<boolean> {
  if (name === UNCLASSIFIED_CATEGORY) {
    return true;
  }
  const found = await Category.exists({ name, retired: false });
  return found !== null;
}

export async function getCategory(name: string): Promise<CategoryDoc | null> {
  return Category.findOne({ name }).lean() as unknown as Promise<CategoryDoc | null>;
}

export async function listAllCategories(): Promise<CategoryDoc[]> {
  return Category.find({}).sort({ name: 1 }).lean() as unknown as Promise<CategoryDoc[]>;
}
