export type ReflectionCategory = "learned" | "could_not" | "next" | "moyamoya" | "other";

export interface Reflection {
  id: string;
  lineUserId: string;
  displayName?: string;
  createdAt: string;
  source: "text" | "voice";
  rawText: string;
  cleanedText?: string;
  categories: ReflectionCategory[];
  isShared: boolean;
}
