import type {
  CiStatus,
  FileViewedState,
  PullRequestCardModel,
  PullRequestDiffFile,
  PullRequestReviewComment,
  PullRequestReviewDecision,
  PullRequestReviewModel,
  PullRequestReviewReaction,
  PullRequestReviewState,
  PullRequestReviewThread,
} from "./pull-request-model";
import { compareReactionContents, isReactionContent } from "./reactions.ts";

type RawActor = {
  avatarUrl?: string | null;
  login: string;
} | null;

export type RawReactionGroup = {
  content: string;
  reactors: {
    totalCount: number;
  };
  viewerHasReacted: boolean;
};

export type RawReviewComment = {
  author: RawActor;
  body: string;
  createdAt: string;
  id: string;
  line: number | null;
  originalLine: number | null;
  path: string | null;
  pullRequestReview?: {
    id: string;
  } | null;
  reactionGroups?: RawReactionGroup[] | null;
  replyTo: {
    id: string;
  } | null;
  state?: string;
  url: string;
};

export type RawReviewThread = {
  comments?: {
    nodes: RawReviewComment[];
  };
  diffSide?: "LEFT" | "RIGHT" | null;
  id?: string;
  isOutdated: boolean;
  isResolved: boolean;
  line?: number | null;
  originalLine?: number | null;
  originalStartLine?: number | null;
  path?: string | null;
  resolvedBy?: {
    login: string;
  } | null;
  rootComment?: {
    nodes: Array<{
      diffHunk: string | null;
      originalCommit: {
        oid: string;
      } | null;
    }>;
  };
  startDiffSide?: "LEFT" | "RIGHT" | null;
  startLine?: number | null;
};

export type RawReviewThreads = {
  nodes: RawReviewThread[];
  pageInfo: {
    endCursor?: string | null;
    hasNextPage: boolean;
  };
};

export type RawPullRequestBase = {
  author: RawActor;
  baseRefName: string;
  headRefName: string;
  id: string;
  isDraft: boolean;
  mergeStateStatus: string | null;
  mergeable: string | null;
  number: number;
  repository: {
    nameWithOwner: string;
  };
  statusCheckRollup: {
    state: string | null;
  } | null;
  title: string;
  updatedAt: string;
  url: string;
};

export type RawPullRequest = RawPullRequestBase & {
  reviewThreads: RawReviewThreads;
};

export type RawPullRequestFiles = {
  nodes: Array<{
    path: string;
    viewerViewedState: string;
  }>;
  pageInfo: {
    endCursor?: string | null;
    hasNextPage: boolean;
  };
  totalCount?: number;
};

export type RawPullRequestReview = RawPullRequestBase & {
  additions: number;
  changedFiles: number;
  deletions: number;
  files?: RawPullRequestFiles;
  headRefOid?: string | null;
  reviewDecision?: string | null;
  reviewThreads: RawReviewThreads;
  reviews?: {
    nodes: Array<{
      id: string;
    }>;
  };
  viewerDidAuthor?: boolean;
  viewerLatestReview?: {
    state: string;
  } | null;
};

const successStates = new Set(["NEUTRAL", "SKIPPED", "SUCCESS"]);
const pendingStates = new Set([
  "EXPECTED",
  "IN_PROGRESS",
  "PENDING",
  "QUEUED",
  "REQUESTED",
  "WAITING",
]);
const failureStates = new Set([
  "ACTION_REQUIRED",
  "CANCELLED",
  "ERROR",
  "FAILURE",
  "STALE",
  "STARTUP_FAILURE",
  "TIMED_OUT",
]);

export function mapCiStatus(state: string | null | undefined): CiStatus {
  if (!state) {
    return "unknown";
  }

  if (successStates.has(state)) {
    return "success";
  }

  if (pendingStates.has(state)) {
    return "pending";
  }

  if (failureStates.has(state)) {
    return "failure";
  }

  return "unknown";
}

export function hasPullRequestConflicts(input: {
  mergeStateStatus: string | null;
  mergeable: string | null;
}) {
  return input.mergeable === "CONFLICTING" || input.mergeStateStatus === "DIRTY";
}

export function countUnresolvedThreads(reviewThreads: RawReviewThreads) {
  const count = reviewThreads.nodes.filter(
    (thread) => !thread.isResolved && !thread.isOutdated,
  ).length;

  return reviewThreads.pageInfo.hasNextPage ? Math.max(count, 100) : count;
}

export function mapPullRequestBase(
  pr: RawPullRequestBase,
  unresolvedThreads: number,
): PullRequestCardModel {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    authorAvatarUrl: pr.author?.avatarUrl ?? null,
    authorLogin: pr.author?.login ?? "ghost",
    baseBranch: pr.baseRefName,
    headBranch: pr.headRefName,
    repositoryName: pr.repository.nameWithOwner,
    updatedAt: pr.updatedAt,
    isDraft: pr.isDraft,
    ciStatus: mapCiStatus(pr.statusCheckRollup?.state),
    hasConflicts: hasPullRequestConflicts({
      mergeStateStatus: pr.mergeStateStatus,
      mergeable: pr.mergeable,
    }),
    unresolvedThreads,
  };
}

export function mapPullRequest(pr: RawPullRequest): PullRequestCardModel {
  return mapPullRequestBase(pr, countUnresolvedThreads(pr.reviewThreads));
}

export function mapPullRequestReview(
  pr: RawPullRequestReview,
  files: PullRequestDiffFile[],
): PullRequestReviewModel {
  const threads = pr.reviewThreads.nodes.map(mapReviewThread);

  return {
    additions: pr.additions,
    changedFiles: pr.changedFiles,
    commentsCount: threads.reduce((count, thread) => count + thread.comments.length, 0),
    deletions: pr.deletions,
    fileViewedStates: Object.fromEntries(
      (pr.files?.nodes ?? []).map((file) => [
        file.path,
        mapFileViewedState(file.viewerViewedState),
      ]),
    ),
    files,
    headRefOid: pr.headRefOid ?? null,
    pendingReviewId: pr.reviews?.nodes[0]?.id ?? null,
    pullRequest: mapPullRequestBase(pr, countUnresolvedThreads(pr.reviewThreads)),
    reviewDecision: mapReviewDecision(pr.reviewDecision),
    threads,
    unresolvedThreads: countUnresolvedThreads(pr.reviewThreads),
    viewerDidAuthor: pr.viewerDidAuthor ?? false,
    viewerLatestReviewState: mapReviewState(pr.viewerLatestReview?.state),
  };
}

const reviewDecisions = new Set(["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"]);
const reviewStates = new Set([
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
  "PENDING",
]);

export function mapReviewDecision(value: string | null | undefined) {
  return value && reviewDecisions.has(value) ? (value as PullRequestReviewDecision) : null;
}

export function mapReviewState(value: string | null | undefined) {
  return value && reviewStates.has(value) ? (value as PullRequestReviewState) : null;
}

export function mapFileViewedState(state: string): FileViewedState {
  if (state === "VIEWED") {
    return "viewed";
  }

  return state === "DISMISSED" ? "dismissed" : "unviewed";
}

export function mapReviewThread(thread: RawReviewThread): PullRequestReviewThread {
  const fallbackPath = thread.path ?? thread.comments?.nodes[0]?.path ?? "unknown";
  const rootComment = thread.rootComment?.nodes[0];

  return {
    id: thread.id ?? `${fallbackPath}:${thread.line ?? thread.originalLine ?? "file"}`,
    comments:
      thread.comments?.nodes.map((comment) => mapReviewComment(comment, fallbackPath)) ?? [],
    diffHunk: rootComment?.diffHunk ?? null,
    diffSide: thread.diffSide ?? null,
    isOutdated: thread.isOutdated,
    isResolved: thread.isResolved,
    line: thread.line ?? null,
    originalCommitOid: rootComment?.originalCommit?.oid ?? null,
    originalLine: thread.originalLine ?? null,
    originalStartLine: thread.originalStartLine ?? null,
    path: fallbackPath,
    resolvedByLogin: thread.resolvedBy?.login ?? null,
    startDiffSide: thread.startDiffSide ?? null,
    startLine: thread.startLine ?? null,
  };
}

export function mapReviewComment(
  comment: RawReviewComment,
  fallbackPath: string,
): PullRequestReviewComment {
  return {
    id: comment.id,
    authorAvatarUrl: comment.author?.avatarUrl ?? null,
    authorLogin: comment.author?.login ?? "ghost",
    body: comment.body,
    createdAt: comment.createdAt,
    isPending: comment.state === "PENDING",
    line: comment.line,
    originalLine: comment.originalLine,
    path: comment.path ?? fallbackPath,
    reactions: mapReactionGroups(comment.reactionGroups),
    replyToId: comment.replyTo?.id ?? null,
    url: comment.url,
  };
}

export function getPendingReviewId(comment: RawReviewComment | undefined) {
  return comment?.state === "PENDING" ? (comment.pullRequestReview?.id ?? null) : null;
}

export function mapReactionGroups(
  groups: RawReactionGroup[] | null | undefined,
): PullRequestReviewReaction[] {
  return (groups ?? [])
    .flatMap((group) =>
      isReactionContent(group.content) && group.reactors.totalCount > 0
        ? [
            {
              content: group.content,
              count: group.reactors.totalCount,
              viewerHasReacted: group.viewerHasReacted,
            },
          ]
        : [],
    )
    .sort((left, right) => compareReactionContents(left.content, right.content));
}
