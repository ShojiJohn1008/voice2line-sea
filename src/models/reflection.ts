export type ReflectionCategory = "learned" | "could_not" | "next" | "moyamoya" | "other";

export type FollowUpStatus = "" | "done" | "dismissed";

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
  followUpStatus?: FollowUpStatus;
}
