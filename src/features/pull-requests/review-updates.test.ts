import { describe, expect, test } from "vite-plus/test";
import type {
  PullRequestReviewComment,
  PullRequestReviewModel,
  PullRequestReviewThread,
} from "./pull-request-model";
import {
  addReviewThread,
  appendReviewThreadComment,
  discardPendingComments,
  findReviewComment,
  mergeFreshPullRequests,
  removeReviewComment,
  setOverviewPullRequest,
  setPendingReviewId,
  setReviewCommentReactions,
  setReviewFileViewedState,
  setReviewSubmitted,
  setReviewThreadResolution,
  toggleReaction,
} from "./review-updates";

describe("review updates", () => {
  test("appends a reply once and recounts comments", () => {
    const reply = createComment("comment-2", "Fixed.");
    const updated = appendReviewThreadComment(review, "thread-1", reply);

    expect(updated.threads[0]?.comments.map((comment) => comment.body)).toEqual([
      "Please add a guard.",
      "Fixed.",
    ]);
    expect(updated.commentsCount).toBe(2);
    expect(appendReviewThreadComment(updated, "thread-1", reply).commentsCount).toBe(2);
  });

  test("adds a new thread and updates the unresolved counts", () => {
    const updated = addReviewThread(review, {
      ...review.threads[0]!,
      comments: [createComment("comment-3", "Another thing.")],
      id: "thread-2",
    });

    expect(updated.threads.map((thread) => thread.id)).toEqual(["thread-1", "thread-2"]);
    expect(updated.unresolvedThreads).toBe(2);
    expect(updated.pullRequest.unresolvedThreads).toBe(2);
    expect(updated.commentsCount).toBe(2);
  });

  test("resolves and unresolves a thread", () => {
    const resolved = setReviewThreadResolution(review, {
      isResolved: true,
      resolvedByLogin: "alexis",
      threadId: "thread-1",
    });
    const reopened = setReviewThreadResolution(resolved, {
      isResolved: false,
      resolvedByLogin: null,
      threadId: "thread-1",
    });

    expect(resolved.threads[0]).toMatchObject({ isResolved: true, resolvedByLogin: "alexis" });
    expect(resolved.unresolvedThreads).toBe(0);
    expect(resolved.pullRequest.unresolvedThreads).toBe(0);
    expect(reopened.threads[0]).toMatchObject({ isResolved: false, resolvedByLogin: null });
    expect(reopened.unresolvedThreads).toBe(1);
  });

  test("replaces the matching PR row in the list", () => {
    const overview = setOverviewPullRequest(
      {
        hasMore: false,
        items: [review.pullRequest, { ...review.pullRequest, id: "pr-2", number: 19 }],
        totalCount: 2,
      },
      { ...review.pullRequest, title: "Renamed", unresolvedThreads: 0 },
    );

    expect(overview.items.map((item) => [item.number, item.title, item.unresolvedThreads])).toEqual(
      [
        [18, "Renamed", 0],
        [19, "Review a large PR", 1],
      ],
    );
  });

  test("records the viewer's approval", () => {
    expect(
      setReviewSubmitted(review, {
        reviewDecision: "APPROVED",
        viewerLatestReviewState: "APPROVED",
      }),
    ).toMatchObject({ reviewDecision: "APPROVED", viewerLatestReviewState: "APPROVED" });
  });

  test("publishes the pending comments of a submitted review", () => {
    const submitted = setReviewSubmitted(reviewWithPendingComments, {
      reviewDecision: "REVIEW_REQUIRED",
      viewerLatestReviewState: "COMMENTED",
    });

    expect(submitted.pendingReviewId).toBeNull();
    expect(submitted.commentsCount).toBe(3);
    expect(
      submitted.threads.flatMap((item) => item.comments.map((comment) => comment.isPending)),
    ).toEqual([false, false, false]);
  });

  test("drops pending comments, and threads left empty, when the review is discarded", () => {
    const discarded = discardPendingComments({
      ...reviewWithPendingComments,
      viewerLatestReviewState: "PENDING",
    });

    expect(discarded).toMatchObject({
      commentsCount: 1,
      pendingReviewId: null,
      unresolvedThreads: 1,
      viewerLatestReviewState: null,
    });
    expect(discarded.threads.map((item) => item.id)).toEqual(["thread-1"]);
    expect(discarded.threads[0]?.comments.map((comment) => comment.id)).toEqual(["comment-1"]);
    expect(discarded.pullRequest.unresolvedThreads).toBe(1);
  });

  test("removes a single comment and the thread it leaves empty", () => {
    const withoutReply = removeReviewComment(reviewWithPendingComments, "comment-2");

    expect(withoutReply.threads.map((item) => item.comments.length)).toEqual([1, 1]);

    const withoutThread = removeReviewComment(withoutReply, "comment-3");

    expect(withoutThread.threads.map((item) => item.id)).toEqual(["thread-1"]);
    expect(withoutThread.commentsCount).toBe(1);
  });

  test("remembers a pending review id without dropping a known one", () => {
    const started = setPendingReviewId(review, "review-1");

    expect(started.pendingReviewId).toBe("review-1");
    expect(setPendingReviewId(started, null)).toBe(started);
    expect(setPendingReviewId(started, "review-1")).toBe(started);
  });

  test("records a file's viewed state", () => {
    const viewed = setReviewFileViewedState(review, "src/review.ts", "viewed");

    expect(viewed.fileViewedStates).toEqual({ "src/review.ts": "viewed" });
    expect(setReviewFileViewedState(viewed, "src/review.ts", "unviewed").fileViewedStates).toEqual({
      "src/review.ts": "unviewed",
    });
    expect(review.fileViewedStates).toEqual({});
  });

  test("merges freshly synced rows into the saved list", () => {
    const saved = {
      hasMore: false,
      items: [
        { ...review.pullRequest, title: "Stale" },
        { ...review.pullRequest, id: "pr-2", number: 19 },
      ],
      totalCount: 2,
    };
    const merged = mergeFreshPullRequests(saved, {
      hasMore: true,
      items: [
        { ...review.pullRequest, title: "Fresh" },
        { ...review.pullRequest, id: "pr-3", number: 20 },
      ],
      totalCount: 60,
    });

    expect(merged.items.map((item) => [item.number, item.title])).toEqual([
      [18, "Fresh"],
      [20, "Review a large PR"],
      [19, "Review a large PR"],
    ]);
    expect(merged).toMatchObject({ hasMore: true, totalCount: 60 });
    expect(mergeFreshPullRequests(undefined, saved)).toEqual(saved);
  });

  test("toggles the viewer's reaction and keeps GitHub's reaction order", () => {
    const reactions = toggleReaction(
      [{ content: "HEART", count: 2, viewerHasReacted: false }],
      "THUMBS_UP",
      true,
    );

    expect(reactions).toEqual([
      { content: "THUMBS_UP", count: 1, viewerHasReacted: true },
      { content: "HEART", count: 2, viewerHasReacted: false },
    ]);
    expect(toggleReaction(reactions, "THUMBS_UP", true)).toBe(reactions);
    expect(toggleReaction(reactions, "THUMBS_UP", false)).toEqual([
      { content: "HEART", count: 2, viewerHasReacted: false },
    ]);
  });

  test("sets the reactions of a single comment", () => {
    const updated = setReviewCommentReactions(review, "comment-1", [
      { content: "ROCKET", count: 3, viewerHasReacted: true },
    ]);

    expect(findReviewComment(updated, "comment-1")?.reactions).toEqual([
      { content: "ROCKET", count: 3, viewerHasReacted: true },
    ]);
    expect(findReviewComment(review, "comment-1")?.reactions).toEqual([]);
    expect(findReviewComment(updated, "missing")).toBeNull();
  });
});

function createComment(id: string, body: string): PullRequestReviewComment {
  return {
    id,
    authorAvatarUrl: null,
    authorLogin: "mira",
    body,
    createdAt: "2026-04-21T09:10:00.000Z",
    isPending: false,
    line: 3,
    originalLine: 3,
    path: "src/review.ts",
    reactions: [],
    replyToId: null,
    url: `https://github.com/openai/pr-status/pull/18#discussion_${id}`,
  };
}

const thread: PullRequestReviewThread = {
  id: "thread-1",
  comments: [createComment("comment-1", "Please add a guard.")],
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
};

const review: PullRequestReviewModel = {
  additions: 1,
  changedFiles: 1,
  commentsCount: 1,
  deletions: 0,
  fileViewedStates: {},
  files: [],
  headRefOid: null,
  pendingReviewId: null,
  reviewDecision: null,
  viewerDidAuthor: false,
  viewerLatestReviewState: null,
  pullRequest: {
    id: "pr-1",
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
  threads: [thread],
  unresolvedThreads: 1,
};

// A pending reply on the open thread, plus a thread that only holds a pending comment.
const reviewWithPendingComments: PullRequestReviewModel = {
  ...review,
  commentsCount: 3,
  pendingReviewId: "review-1",
  threads: [
    {
      ...thread,
      comments: [
        ...thread.comments,
        { ...createComment("comment-2", "Pending reply."), isPending: true },
      ],
    },
    {
      ...thread,
      comments: [{ ...createComment("comment-3", "Pending thread."), isPending: true }],
      id: "thread-2",
    },
  ],
  unresolvedThreads: 2,
};
