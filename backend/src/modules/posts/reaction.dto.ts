import { ReactionType } from "../../generated/prisma/client.js";
import type { ReactionBreakdown, ReactionPreviewRecord } from "./post.types.js";

export const reactionValues = ["like", "love", "care", "haha", "wow", "sad", "angry"] as const;
export type ReactionValue = typeof reactionValues[number];

export function toReactionType(value: ReactionValue): ReactionType {
  return ReactionType[value.toUpperCase() as keyof typeof ReactionType];
}

export function reactionValue(value: ReactionType): ReactionValue {
  return value.toLowerCase() as ReactionValue;
}

export function reactionBreakdownDto(breakdown: ReactionBreakdown): Record<ReactionValue, number> {
  return {
    like: breakdown.LIKE,
    love: breakdown.LOVE,
    care: breakdown.CARE,
    haha: breakdown.HAHA,
    wow: breakdown.WOW,
    sad: breakdown.SAD,
    angry: breakdown.ANGRY,
  };
}

export function reactionPreviewDto(preview: ReactionPreviewRecord[]) {
  return preview.map(({ user, reactionType, updatedAt }) => ({
    user,
    reaction: reactionValue(reactionType),
    reactedAt: updatedAt.toISOString(),
  }));
}
