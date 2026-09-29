export const reactionContents = [
  "THUMBS_UP",
  "THUMBS_DOWN",
  "LAUGH",
  "HOORAY",
  "CONFUSED",
  "HEART",
  "ROCKET",
  "EYES",
] as const;

export type ReactionContent = (typeof reactionContents)[number];

export const reactionEmoji: Record<ReactionContent, string> = {
  CONFUSED: "😕",
  EYES: "👀",
  HEART: "❤️",
  HOORAY: "🎉",
  LAUGH: "😄",
  ROCKET: "🚀",
  THUMBS_DOWN: "👎",
  THUMBS_UP: "👍",
};

export const reactionLabels: Record<ReactionContent, string> = {
  CONFUSED: "confused",
  EYES: "eyes",
  HEART: "heart",
  HOORAY: "hooray",
  LAUGH: "laugh",
  ROCKET: "rocket",
  THUMBS_DOWN: "thumbs down",
  THUMBS_UP: "thumbs up",
};

export function isReactionContent(value: unknown): value is ReactionContent {
  return reactionContents.includes(value as ReactionContent);
}

export function compareReactionContents(left: ReactionContent, right: ReactionContent) {
  return reactionContents.indexOf(left) - reactionContents.indexOf(right);
}
