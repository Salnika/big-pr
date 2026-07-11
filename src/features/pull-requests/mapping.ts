import type {
  CiStatus,
  PullRequestCardModel,
  PullRequestDiffFile,
  PullRequestReviewModel,
  PullRequestReviewThread,
} from "./pull-request-model";

export type RawReviewThread = {
  comments?: {
    nodes: Array<{
      author: {
        login: string;
      } | null;
      body: string;
      createdAt: string;
      id: string;
      line: number | null;
      originalLine: number | null;
      path: string | null;
      replyTo: {
        id: string;
      } | null;
      url: string;
    }>;
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
  author: {
    login: string;
  } | null;
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

export type RawPullRequestReview = RawPullRequestBase & {
  additions: number;
  changedFiles: number;
  deletions: number;
  reviewThreads: RawReviewThreads;
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
    files,
    pullRequest: mapPullRequestBase(pr, countUnresolvedThreads(pr.reviewThreads)),
    threads,
    unresolvedThreads: countUnresolvedThreads(pr.reviewThreads),
  };
}

function mapReviewThread(thread: RawReviewThread): PullRequestReviewThread {
  const fallbackPath = thread.path ?? thread.comments?.nodes[0]?.path ?? "unknown";

  return {
    id: thread.id ?? `${fallbackPath}:${thread.line ?? thread.originalLine ?? "file"}`,
    comments:
      thread.comments?.nodes.map((comment) => ({
        id: comment.id,
        authorLogin: comment.author?.login ?? "ghost",
        body: comment.body,
        createdAt: comment.createdAt,
        line: comment.line,
        originalLine: comment.originalLine,
        path: comment.path ?? fallbackPath,
        replyToId: comment.replyTo?.id ?? null,
        url: comment.url,
      })) ?? [],
    diffSide: thread.diffSide ?? null,
    isOutdated: thread.isOutdated,
    isResolved: thread.isResolved,
    line: thread.line ?? null,
    originalLine: thread.originalLine ?? null,
    originalStartLine: thread.originalStartLine ?? null,
    path: fallbackPath,
    resolvedByLogin: thread.resolvedBy?.login ?? null,
    startDiffSide: thread.startDiffSide ?? null,
    startLine: thread.startLine ?? null,
  };
}
