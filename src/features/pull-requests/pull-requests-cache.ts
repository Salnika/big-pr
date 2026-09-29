import {
  deletePersistentEntries,
  readPersistentEntry,
  writePersistentEntry,
} from "../../shared/lib/persistent-cache";
import type {
  PullRequestCardModel,
  PullRequestReviewComment,
  PullRequestReviewModel,
  PullRequestReviewThread,
  PullRequestsOverview,
} from "./pull-request-model";

type Repository = {
  owner: string;
  repo: string;
};

export type CachedResource<T> = {
  data: T;
  fetchedAt: number;
};

// Entries saved by earlier versions can miss fields that were added since.
type StoredPullRequest = Omit<PullRequestCardModel, "authorAvatarUrl"> &
  Partial<Pick<PullRequestCardModel, "authorAvatarUrl">>;
type StoredComment = Omit<PullRequestReviewComment, "authorAvatarUrl" | "isPending" | "reactions"> &
  Partial<Pick<PullRequestReviewComment, "authorAvatarUrl" | "isPending" | "reactions">>;
type StoredThread = Omit<PullRequestReviewThread, "comments" | "diffHunk" | "originalCommitOid"> &
  Partial<Pick<PullRequestReviewThread, "diffHunk" | "originalCommitOid">> & {
    comments: StoredComment[];
  };
type ReviewFieldsAddedLater =
  | "fileViewedStates"
  | "headRefOid"
  | "pendingReviewId"
  | "reviewDecision"
  | "viewerDidAuthor"
  | "viewerLatestReviewState";
type StoredReview = Omit<
  PullRequestReviewModel,
  ReviewFieldsAddedLater | "pullRequest" | "threads"
> &
  Partial<Pick<PullRequestReviewModel, ReviewFieldsAddedLater>> & {
    pullRequest: StoredPullRequest;
    threads: StoredThread[];
  };
type StoredOverview = Omit<PullRequestsOverview, "items"> & {
  items: StoredPullRequest[];
};

const legacyPullRequestsCachePrefix = "pr-status:pull-requests:v1";
const legacyPullRequestReviewCachePrefixes = [
  "pr-status:pull-request-review:v2",
  "pr-status:pull-request-review:v1",
];

export async function readPullRequestsCache(
  repository: Repository,
): Promise<CachedResource<PullRequestsOverview> | null> {
  const key = getPullRequestsCacheKey(repository);
  const entry =
    (await readPersistentEntry(key)) ??
    (await migrateLegacyEntry(key, [
      `${legacyPullRequestsCachePrefix}:${repository.owner}/${repository.repo}`,
    ]));

  if (!isCachedResource(entry) || !isStoredOverview(entry.data)) {
    return null;
  }

  return {
    data: {
      ...entry.data,
      items: entry.data.items.map(normalizePullRequest),
    },
    fetchedAt: entry.fetchedAt,
  };
}

export function writePullRequestsCache(
  repository: Repository,
  entry: CachedResource<PullRequestsOverview>,
) {
  return writePersistentEntry(getPullRequestsCacheKey(repository), entry);
}

export async function readPullRequestReviewCache(
  repository: Repository,
  number: number,
): Promise<CachedResource<PullRequestReviewModel> | null> {
  const key = getPullRequestReviewCacheKey(repository, number);
  const entry =
    (await readPersistentEntry(key)) ??
    (await migrateLegacyEntry(
      key,
      legacyPullRequestReviewCachePrefixes.map(
        (prefix) => `${prefix}:${repository.owner}/${repository.repo}/${number}`,
      ),
    ));

  if (!isCachedResource(entry) || !isStoredReview(entry.data, number)) {
    return null;
  }

  return {
    data: normalizeReview(entry.data),
    fetchedAt: entry.fetchedAt,
  };
}

export function writePullRequestReviewCache(
  repository: Repository,
  number: number,
  entry: CachedResource<PullRequestReviewModel>,
) {
  return writePersistentEntry(getPullRequestReviewCacheKey(repository, number), entry);
}

export async function readCachedRepositoryFile(
  repository: Repository,
  number: number,
  ref: string,
  path: string,
) {
  const content = await readPersistentEntry(
    getRepositoryFileCacheKey(repository, number, ref, path),
  );

  return typeof content === "string" ? content : undefined;
}

export function writeCachedRepositoryFile(
  repository: Repository,
  number: number,
  ref: string,
  path: string,
  content: string,
) {
  return writePersistentEntry(getRepositoryFileCacheKey(repository, number, ref, path), content);
}

export function pruneCachedRepositoryFiles(
  repository: Repository,
  number: number,
  keptRefs: ReadonlySet<string>,
) {
  const prefix = getRepositoryFilesCachePrefix(repository, number);

  return deletePersistentEntries(
    prefix,
    (key) => !keptRefs.has(key.slice(prefix.length).split(":")[0] ?? ""),
  );
}

function getPullRequestsCacheKey(repository: Repository) {
  return `pull-requests:${repository.owner}/${repository.repo}`;
}

function getPullRequestReviewCacheKey(repository: Repository, number: number) {
  return `pull-request-review:${repository.owner}/${repository.repo}#${number}`;
}

function getRepositoryFilesCachePrefix(repository: Repository, number: number) {
  return `repository-file:${repository.owner}/${repository.repo}#${number}:`;
}

function getRepositoryFileCacheKey(
  repository: Repository,
  number: number,
  ref: string,
  path: string,
) {
  return `${getRepositoryFilesCachePrefix(repository, number)}${ref}:${path}`;
}

async function migrateLegacyEntry(key: string, legacyKeys: string[]) {
  const legacyEntry = legacyKeys.map(readLegacyEntry).find(Boolean);

  if (!legacyEntry) {
    return undefined;
  }

  const entry = {
    data: legacyEntry.data,
    fetchedAt: legacyEntry.dataUpdatedAt,
  };

  await writePersistentEntry(key, entry);
  legacyKeys.forEach((legacyKey) => {
    try {
      globalThis.localStorage?.removeItem(legacyKey);
    } catch {
      // The old copy stays readable; nothing else depends on removing it.
    }
  });

  return entry;
}

function readLegacyEntry(legacyKey: string) {
  try {
    const rawValue = globalThis.localStorage?.getItem(legacyKey);
    const parsed: unknown = rawValue ? JSON.parse(rawValue) : null;

    return isObject(parsed) && "data" in parsed && typeof parsed.dataUpdatedAt === "number"
      ? { data: parsed.data, dataUpdatedAt: parsed.dataUpdatedAt }
      : null;
  } catch {
    return null;
  }
}

function normalizePullRequest(pullRequest: StoredPullRequest): PullRequestCardModel {
  return {
    ...pullRequest,
    authorAvatarUrl: pullRequest.authorAvatarUrl ?? null,
  };
}

function normalizeReview(review: StoredReview): PullRequestReviewModel {
  return {
    ...review,
    fileViewedStates: review.fileViewedStates ?? {},
    headRefOid: review.headRefOid ?? null,
    pendingReviewId: review.pendingReviewId ?? null,
    pullRequest: normalizePullRequest(review.pullRequest),
    reviewDecision: review.reviewDecision ?? null,
    viewerDidAuthor: review.viewerDidAuthor ?? false,
    viewerLatestReviewState: review.viewerLatestReviewState ?? null,
    threads: review.threads.map((thread) => ({
      ...thread,
      comments: thread.comments.map((comment) => ({
        ...comment,
        authorAvatarUrl: comment.authorAvatarUrl ?? null,
        isPending: comment.isPending ?? false,
        reactions: comment.reactions ?? [],
      })),
      diffHunk: thread.diffHunk ?? null,
      originalCommitOid: thread.originalCommitOid ?? null,
    })),
  };
}

function isCachedResource(value: unknown): value is CachedResource<unknown> {
  return isObject(value) && "data" in value && typeof value.fetchedAt === "number";
}

function isStoredOverview(value: unknown): value is StoredOverview {
  return (
    isObject(value) &&
    Array.isArray(value.items) &&
    typeof value.hasMore === "boolean" &&
    typeof value.totalCount === "number"
  );
}

function isStoredReview(value: unknown, number: number): value is StoredReview {
  return (
    isObject(value) &&
    isObject(value.pullRequest) &&
    value.pullRequest.number === number &&
    Array.isArray(value.files) &&
    Array.isArray(value.threads) &&
    typeof value.additions === "number" &&
    typeof value.changedFiles === "number" &&
    typeof value.commentsCount === "number" &&
    typeof value.deletions === "number" &&
    typeof value.unresolvedThreads === "number"
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
