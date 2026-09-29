import { describe, expect, test } from "vite-plus/test";
import type { PullRequestReviewModel } from "./pull-request-model";
import {
  pruneCachedRepositoryFiles,
  readCachedRepositoryFile,
  readPullRequestReviewCache,
  readPullRequestsCache,
  writeCachedRepositoryFile,
  writePullRequestReviewCache,
} from "./pull-requests-cache";

const repository = { owner: "openai", repo: "pr-status" };

describe("pull requests cache", () => {
  test("keeps a review until it is replaced", async () => {
    await writePullRequestReviewCache(repository, 18, { data: review, fetchedAt: 1 });

    expect(await readPullRequestReviewCache(repository, 18)).toEqual({
      data: review,
      fetchedAt: 1,
    });
    expect(await readPullRequestReviewCache(repository, 19)).toBeNull();

    await writePullRequestReviewCache(repository, 18, {
      data: { ...review, additions: 12 },
      fetchedAt: 2,
    });

    expect((await readPullRequestReviewCache(repository, 18))?.data.additions).toBe(12);
  });

  test("moves reviews saved in localStorage by earlier versions and fills new fields", async () => {
    const {
      fileViewedStates: _fileViewedStates,
      headRefOid: _headRefOid,
      pendingReviewId: _pendingReviewId,
      reviewDecision: _reviewDecision,
      viewerDidAuthor: _viewerDidAuthor,
      viewerLatestReviewState: _viewerLatestReviewState,
      ...legacyReview
    } = review;

    window.localStorage.setItem(
      "pr-status:pull-request-review:v1:openai/pr-status/18",
      JSON.stringify({
        data: {
          ...legacyReview,
          pullRequest: { ...review.pullRequest, authorAvatarUrl: undefined },
          threads: [
            {
              ...review.threads[0],
              comments: [
                { ...review.threads[0].comments[0], isPending: undefined, reactions: undefined },
              ],
              diffHunk: undefined,
              originalCommitOid: undefined,
            },
          ],
        },
        dataUpdatedAt: 42,
      }),
    );

    const cached = await readPullRequestReviewCache(repository, 18);

    expect(cached?.fetchedAt).toBe(42);
    expect(cached?.data.headRefOid).toBeNull();
    expect(cached?.data.fileViewedStates).toEqual({});
    expect(cached?.data).toMatchObject({
      pendingReviewId: null,
      reviewDecision: null,
      viewerDidAuthor: false,
      viewerLatestReviewState: null,
    });
    expect(cached?.data.pullRequest.authorAvatarUrl).toBeNull();
    expect(cached?.data.threads[0]).toMatchObject({ diffHunk: null, originalCommitOid: null });
    expect(cached?.data.threads[0]?.comments[0]).toMatchObject({ isPending: false, reactions: [] });
    expect(
      window.localStorage.getItem("pr-status:pull-request-review:v1:openai/pr-status/18"),
    ).toBeNull();
    expect((await readPullRequestReviewCache(repository, 18))?.fetchedAt).toBe(42);
  });

  test("moves the saved PR list out of localStorage", async () => {
    window.localStorage.setItem(
      "pr-status:pull-requests:v1:openai/pr-status",
      JSON.stringify({
        data: { hasMore: false, items: [review.pullRequest], totalCount: 1 },
        dataUpdatedAt: 7,
      }),
    );

    const cached = await readPullRequestsCache(repository);

    expect(cached?.fetchedAt).toBe(7);
    expect(cached?.data.items.map((item) => item.number)).toEqual([18]);
    expect(window.localStorage.getItem("pr-status:pull-requests:v1:openai/pr-status")).toBeNull();
  });

  test("keeps only the files of commits a refreshed review still uses", async () => {
    await writeCachedRepositoryFile(repository, 18, "a".repeat(40), "src/app.ts", "head");
    await writeCachedRepositoryFile(repository, 18, "b".repeat(40), "src/app.ts", "old head");
    await writeCachedRepositoryFile(repository, 180, "b".repeat(40), "src/app.ts", "other PR");

    await pruneCachedRepositoryFiles(repository, 18, new Set(["a".repeat(40)]));

    expect(await readCachedRepositoryFile(repository, 18, "a".repeat(40), "src/app.ts")).toBe(
      "head",
    );
    expect(
      await readCachedRepositoryFile(repository, 18, "b".repeat(40), "src/app.ts"),
    ).toBeUndefined();
    expect(await readCachedRepositoryFile(repository, 180, "b".repeat(40), "src/app.ts")).toBe(
      "other PR",
    );
  });
});

const review: PullRequestReviewModel = {
  additions: 1,
  changedFiles: 1,
  commentsCount: 1,
  deletions: 0,
  fileViewedStates: {},
  files: [],
  headRefOid: "a".repeat(40),
  pendingReviewId: null,
  reviewDecision: null,
  viewerDidAuthor: false,
  viewerLatestReviewState: null,
  pullRequest: {
    id: "pr-18",
    number: 18,
    title: "Review a large PR",
    url: "https://github.com/openai/pr-status/pull/18",
    authorAvatarUrl: null,
    authorLogin: "alexis",
    baseBranch: "main",
    headBranch: "large-review",
    repositoryName: "openai/pr-status",
    updatedAt: "2026-04-21T09:00:00.000Z",
    isDraft: false,
    ciStatus: "success",
    hasConflicts: false,
    unresolvedThreads: 1,
  },
  threads: [
    {
      id: "thread-1",
      comments: [
        {
          id: "comment-1",
          authorAvatarUrl: null,
          authorLogin: "mira",
          body: "This branch needs a guard.",
          createdAt: "2026-04-21T09:10:00.000Z",
          isPending: false,
          line: 3,
          originalLine: 3,
          path: "src/review.ts",
          reactions: [],
          replyToId: null,
          url: "https://github.com/openai/pr-status/pull/18#discussion_r1",
        },
      ],
      diffHunk: null,
      diffSide: "RIGHT",
      isOutdated: false,
      isResolved: false,
      line: 3,
      originalCommitOid: null,
      originalLine: 3,
      originalStartLine: null,
      path: "src/review.ts",
      resolvedByLogin: null,
      startDiffSide: null,
      startLine: null,
    },
  ],
  unresolvedThreads: 1,
};
