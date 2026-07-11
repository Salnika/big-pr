import type { RepoSettings } from "../settings/repo-parser";
import type { PullRequestReviewModel, PullRequestsOverview } from "./pull-request-model";

const pullRequestsCachePrefix = "pr-status:pull-requests:v1";
const pullRequestReviewCachePrefix = "pr-status:pull-request-review:v1";

type CachedPullRequests = {
  data: PullRequestsOverview;
  dataUpdatedAt: number;
};

type CachedPullRequestReview = {
  data: PullRequestReviewModel;
  dataUpdatedAt: number;
};

export function readPullRequestsCache(settings: RepoSettings): CachedPullRequests | null {
  if (!settings.owner || !settings.repo) {
    return null;
  }

  try {
    const rawValue = globalThis.localStorage?.getItem(getPullRequestsCacheKey(settings));

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<CachedPullRequests>;

    if (!isCachedPullRequests(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function readPullRequestReviewCache(
  settings: RepoSettings,
  number: number,
): CachedPullRequestReview | null {
  if (!settings.owner || !settings.repo || number <= 0) {
    return null;
  }

  try {
    const rawValue = globalThis.localStorage?.getItem(
      getPullRequestReviewCacheKey(settings, number),
    );

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<CachedPullRequestReview>;

    if (!isCachedPullRequestReview(parsed, number)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writePullRequestsCache(input: {
  data: PullRequestsOverview;
  dataUpdatedAt: number;
  settings: RepoSettings;
}) {
  if (!input.settings.owner || !input.settings.repo) {
    return;
  }

  try {
    globalThis.localStorage?.setItem(
      getPullRequestsCacheKey(input.settings),
      JSON.stringify({
        data: input.data,
        dataUpdatedAt: input.dataUpdatedAt || Date.now(),
      } satisfies CachedPullRequests),
    );
  } catch {
    // Storage can be unavailable or full; the live query remains the source of truth.
  }
}

export function writePullRequestReviewCache(input: {
  data: PullRequestReviewModel;
  dataUpdatedAt: number;
  number: number;
  settings: RepoSettings;
}) {
  if (!input.settings.owner || !input.settings.repo || input.number <= 0) {
    return;
  }

  try {
    globalThis.localStorage?.setItem(
      getPullRequestReviewCacheKey(input.settings, input.number),
      JSON.stringify({
        data: input.data,
        dataUpdatedAt: input.dataUpdatedAt || Date.now(),
      } satisfies CachedPullRequestReview),
    );
  } catch {
    // Storage can be unavailable or full; the live query remains the source of truth.
  }
}

function getPullRequestsCacheKey(settings: RepoSettings) {
  return `${pullRequestsCachePrefix}:${settings.owner}/${settings.repo}`;
}

function getPullRequestReviewCacheKey(settings: RepoSettings, number: number) {
  return `${pullRequestReviewCachePrefix}:${settings.owner}/${settings.repo}/${number}`;
}

function isCachedPullRequests(input: Partial<CachedPullRequests>): input is CachedPullRequests {
  return (
    typeof input.dataUpdatedAt === "number" &&
    Boolean(input.data) &&
    Array.isArray(input.data?.items) &&
    typeof input.data?.hasMore === "boolean" &&
    typeof input.data?.totalCount === "number"
  );
}

function isCachedPullRequestReview(
  input: Partial<CachedPullRequestReview>,
  number: number,
): input is CachedPullRequestReview {
  return (
    typeof input.dataUpdatedAt === "number" &&
    Boolean(input.data) &&
    input.data?.pullRequest?.number === number &&
    Array.isArray(input.data?.files) &&
    Array.isArray(input.data?.threads) &&
    typeof input.data?.additions === "number" &&
    typeof input.data?.changedFiles === "number" &&
    typeof input.data?.commentsCount === "number" &&
    typeof input.data?.deletions === "number" &&
    typeof input.data?.unresolvedThreads === "number"
  );
}
