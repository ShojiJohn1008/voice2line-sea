import { v4 as uuidv4 } from "uuid";
import { Reflection } from "../models/reflection";
import { classifyReflection } from "./llm";
import { appendReflectionIfNew } from "./sheets";

export async function recordReflection(params: {
  id?: string;
  lineUserId: string;
  displayName?: string;
  rawText: string;
  source: "text" | "voice";
}): Promise<{ reflection: Reflection; saved: boolean }> {
  const rawText = params.rawText.trim();
  const classification = await classifyReflection(rawText);
  const reflection: Reflection = {
    id: params.id || uuidv4(),
    lineUserId: params.lineUserId,
    displayName: params.displayName,
    createdAt: new Date().toISOString(),
    source: params.source,
    rawText,
    cleanedText: classification.cleanedText,
    categories: classification.categories,
    isShared: false,
  };

  const saved = await appendReflectionIfNew(reflection);
  return { reflection, saved };
}
