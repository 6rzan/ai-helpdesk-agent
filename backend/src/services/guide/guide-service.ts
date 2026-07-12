import { Guide, type GuideDoc } from "../../models/guide.js";

export async function getActiveGuide(categoryName: string): Promise<GuideDoc | null> {
  return Guide.findOne({ categoryName, active: true }).lean() as unknown as Promise<GuideDoc | null>;
}

export async function getGuideVersion(categoryName: string, version: number): Promise<GuideDoc | null> {
  return Guide.findOne({ categoryName, version }).lean() as unknown as Promise<GuideDoc | null>;
}

export async function listGuideVersions(categoryName: string): Promise<GuideDoc[]> {
  return Guide.find({ categoryName }).sort({ version: -1 }).lean() as unknown as Promise<GuideDoc[]>;
}
