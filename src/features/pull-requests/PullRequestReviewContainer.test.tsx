import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vite-plus/test";
import { renderWithProviders } from "../../test/render-with-providers";
import { PullRequestReviewContainer } from "./PullRequestReviewContainer";
import type {
  PullRequestDiffFile,
  PullRequestReviewComment,
  PullRequestReviewModel,
  PullRequestReviewThread,
} from "./pull-request-model";
import type { ReviewTab } from "./PullRequestReview";
import {
  readCachedRepositoryFile,
  readPullRequestReviewCache,
  readPullRequestsCache,
  writePullRequestReviewCache,
  writePullRequestsCache,
} from "./pull-requests-cache";

describe("PullRequestReviewContainer", () => {
  test("does not fetch a PR review until the PR is fetched", async () => {
    const fetchMock = mockFetchResponse(200, review);

    renderReviewContainer();

    expect(await screen.findByText("No saved review for PR #18")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to PRs" }).getAttribute("href")).toBe(
      "/openai/pr-status/pulls",
    );
    expect(screen.queryByRole("button", { name: "Refresh PR" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Fetch PR" }));

    expect(await screen.findByRole("heading", { name: "#18 Review a large PR" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    await waitFor(async () => {
      expect((await readPullRequestReviewCache(repository, 18))?.data.pullRequest.title).toBe(
        "Review a large PR",
      );
    });
  });

  test("renders a cached PR review without refreshing in the background", async () => {
    await writeCachedReview(review);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderReviewContainer();

    expect(await screen.findByRole("heading", { name: "#18 Review a large PR" })).toBeTruthy();
    expect(screen.getByText(/synced/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("replaces the saved review only when the PR is refreshed", async () => {
    await writeCachedReview(review);
    const fetchMock = mockFetchResponse(200, {
      ...review,
      pullRequest: { ...review.pullRequest, title: "Review a large PR, take two" },
    });

    renderReviewContainer();
    await screen.findByRole("heading", { name: "#18 Review a large PR" });
    await userEvent.click(screen.getByRole("button", { name: "Refresh PR" }));

    expect(
      await screen.findByRole("heading", { name: "#18 Review a large PR, take two" }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect((await readPullRequestReviewCache(repository, 18))?.data.pullRequest.title).toBe(
      "Review a large PR, take two",
    );
  });

  test("updates the review and the PR list after resolving a thread without refetching", async () => {
    await writeCachedReview({
      ...review,
      pullRequest: { ...review.pullRequest, unresolvedThreads: 1 },
      threads: [openThread],
      unresolvedThreads: 1,
    });
    await writePullRequestsCache(repository, {
      data: {
        hasMore: false,
        items: [{ ...review.pullRequest, unresolvedThreads: 1 }],
        totalCount: 1,
      },
      fetchedAt: 1,
    });
    const fetchMock = mockFetchResponse(200, {
      isResolved: true,
      resolvedByLogin: "alexis",
      threadId: "thread-1",
    });

    renderReviewContainer({ tab: "comments" });

    await userEvent.click(await screen.findByRole("button", { name: "Resolve" }));

    expect(await screen.findByRole("button", { name: "Unresolve" })).toBeTruthy();
    expect(screen.getByText("resolved by @alexis")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/local/github/review-thread-resolution");
    await waitFor(async () => {
      expect((await readPullRequestReviewCache(repository, 18))?.data.unresolvedThreads).toBe(0);
      expect((await readPullRequestsCache(repository))?.data.items[0]?.unresolvedThreads).toBe(0);
    });
  });

  test("shows a new reply right away without refetching the PR", async () => {
    await writeCachedReview({ ...review, commentsCount: 1, threads: [openThread] });
    const fetchMock = mockFetchResponse(200, {
      comment: {
        ...openThread.comments[0],
        authorLogin: "alexis",
        body: "Guard added.",
        id: "comment-2",
      },
      pendingReviewId: null,
      threadId: "thread-1",
    });

    renderReviewContainer({ tab: "comments" });

    await userEvent.type(
      await screen.findByLabelText("Reply to review thread at src/review.ts:3"),
      "Guard added.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(await screen.findByText("Guard added.")).toBeTruthy();
    expect(
      (screen.getByLabelText("Reply to review thread at src/review.ts:3") as HTMLTextAreaElement)
        .value,
    ).toBe("");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("reacts right away and keeps GitHub's answer", async () => {
    await writeCachedReview({ ...review, commentsCount: 1, threads: [openThread] });
    let resolveReaction: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          resolveReaction = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderReviewContainer({ tab: "comments" });

    await userEvent.click(await screen.findByRole("button", { name: "Add reaction" }));
    await userEvent.click(screen.getByRole("button", { name: "React with rocket" }));

    const reactions = screen.getByRole("group", { name: "Reactions" });

    expect(within(reactions).getByRole("button", { name: "rocket: 1" })).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      commentId: "comment-1",
      content: "ROCKET",
      hasReacted: true,
    });

    resolveReaction(
      new Response(
        JSON.stringify({
          commentId: "comment-1",
          reactions: [{ content: "ROCKET", count: 2, viewerHasReacted: true }],
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );

    expect(await within(reactions).findByRole("button", { name: "rocket: 2" })).toBeTruthy();
    await waitFor(async () => {
      expect(
        (await readPullRequestReviewCache(repository, 18))?.data.threads[0]?.comments[0]?.reactions,
      ).toEqual([{ content: "ROCKET", count: 2, viewerHasReacted: true }]);
    });
  });

  test("rolls a reaction back when GitHub rejects it", async () => {
    await writeCachedReview({
      ...review,
      commentsCount: 1,
      threads: [
        {
          ...openThread,
          comments: [
            {
              ...openThread.comments[0],
              reactions: [{ content: "HEART", count: 1, viewerHasReacted: true }],
            },
          ],
        },
      ],
    });
    mockFetchResponse(502, {
      message: "GitHub did not return the updated reactions.",
      status: 502,
      type: "unknown",
    });

    renderReviewContainer({ tab: "comments" });

    await userEvent.click(await screen.findByRole("button", { name: "heart: 1" }));

    expect(await screen.findByText("GitHub did not return the updated reactions.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "heart: 1" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  test("marks a file as viewed right away and saves it", async () => {
    await writeCachedReview({ ...review, files: [reviewFile] });
    const fetchMock = mockFetchResponse(200, { path: "src/review.ts", viewedState: "viewed" });

    renderReviewContainer();

    const checkbox = (await screen.findByRole("checkbox", { name: "Viewed" })) as HTMLInputElement;

    await userEvent.click(checkbox);

    expect(checkbox.checked).toBe(true);
    expect(screen.getByText("1 of 1 files viewed")).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      path: "src/review.ts",
      pullRequestId: "pr-18",
      viewed: true,
    });
    await waitFor(async () => {
      expect((await readPullRequestReviewCache(repository, 18))?.data.fileViewedStates).toEqual({
        "src/review.ts": "viewed",
      });
    });
  });

  test("unchecks a file again when GitHub refuses the change", async () => {
    await writeCachedReview({ ...review, files: [reviewFile] });
    mockFetchResponse(502, {
      message: "GitHub could not save the viewed state.",
      status: 502,
      type: "unknown",
    });

    renderReviewContainer();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Viewed" }));

    expect(await screen.findByText("GitHub could not save the viewed state.")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Viewed" }) as HTMLInputElement).checked).toBe(
      false,
    );
    expect(screen.getByText("0 of 1 files viewed")).toBeTruthy();
  });

  test("approves the pull request and keeps the new review state", async () => {
    await writeCachedReview({ ...review, reviewDecision: "REVIEW_REQUIRED" });
    const fetchMock = mockFetchResponse(200, {
      reviewDecision: "APPROVED",
      viewerLatestReviewState: "APPROVED",
    });

    renderReviewContainer();

    await userEvent.click(await screen.findByRole("button", { name: "Review changes" }));
    await userEvent.type(screen.getByLabelText("Review summary"), "Looks good");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("✓ You approved")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/local/github/review-submissions");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      body: "Looks good",
      event: "APPROVE",
      pullRequestId: "pr-18",
    });
    await waitFor(async () => {
      expect((await readPullRequestReviewCache(repository, 18))?.data.viewerLatestReviewState).toBe(
        "APPROVED",
      );
    });
  });

  test("publishes the pending comments when the review is submitted", async () => {
    await writeCachedReview(reviewWithPendingComments);
    const fetchMock = mockFetchResponse(200, {
      reviewDecision: "REVIEW_REQUIRED",
      viewerLatestReviewState: "COMMENTED",
    });

    renderReviewContainer({ tab: "comments" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Review changes, 2 comments pending" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByRole("button", { name: "Review changes" })).toBeTruthy();
    expect(screen.queryByText("Pending")).toBeNull();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      body: "",
      event: "COMMENT",
      pullRequestId: "pr-18",
    });
    await waitFor(async () => {
      const cached = (await readPullRequestReviewCache(repository, 18))?.data;

      expect(cached?.pendingReviewId).toBeNull();
      expect(
        cached?.threads.some((thread) => thread.comments.some((comment) => comment.isPending)),
      ).toBe(false);
    });
  });

  test("discards the pending review and drops its comments", async () => {
    await writeCachedReview(reviewWithPendingComments);
    const fetchMock = mockFetchResponse(200, { pullRequestReviewId: "review-1" });

    renderReviewContainer({ tab: "comments" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Review changes, 2 comments pending" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Discard review" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard review" }));

    expect(await screen.findByText("Showing 1 of 1 threads")).toBeTruthy();
    expect(screen.queryByText("Pending reply.")).toBeNull();
    expect(screen.queryByText("Draft note.")).toBeNull();
    expect(screen.getByText("This branch needs a guard.")).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/local/github/pending-review-discards");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      pullRequestReviewId: "review-1",
    });
    await waitFor(async () => {
      const cached = (await readPullRequestReviewCache(repository, 18))?.data;

      expect(cached?.pendingReviewId).toBeNull();
      expect(cached?.commentsCount).toBe(1);
    });
  });

  test("starts a review from a diff line, then adds to it", async () => {
    await writeCachedReview({ ...review, files: [reviewFile] });
    const fetchMock = mockFetchResponse(200, {
      pendingReviewId: "review-9",
      thread: {
        ...openThread,
        comments: [{ ...pendingComment, body: "Draft note.", id: "comment-9", line: 2 }],
        id: "thread-9",
        line: 2,
        originalLine: 2,
      },
    });

    renderReviewContainer();

    await userEvent.click(
      await screen.findByRole("button", { name: "Add comment on src/review.ts:2" }),
    );
    await userEvent.type(screen.getByLabelText("New comment on src/review.ts:2"), "Draft note.");
    await userEvent.click(screen.getByRole("button", { name: "Start a review" }));

    expect(
      await screen.findByRole("button", { name: "Review changes, 1 comment pending" }),
    ).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      publish: false,
    });
    await waitFor(async () => {
      expect((await readPullRequestReviewCache(repository, 18))?.data.pendingReviewId).toBe(
        "review-9",
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Add comment on src/review.ts:1" }));

    const newComment = screen.getByLabelText("New comment on src/review.ts:1");

    expect(
      within(newComment.closest("form") as HTMLElement).queryByRole("button", {
        name: "Start a review",
      }),
    ).toBeNull();
  });

  test("replies into the pending review", async () => {
    await writeCachedReview({
      ...review,
      commentsCount: 1,
      pendingReviewId: "review-1",
      threads: [openThread],
    });
    const fetchMock = mockFetchResponse(200, {
      comment: { ...pendingComment, body: "Folded in.", id: "comment-5" },
      pendingReviewId: "review-1",
      threadId: "thread-1",
    });

    renderReviewContainer({ tab: "comments" });

    await userEvent.type(
      await screen.findByLabelText("Reply to review thread at src/review.ts:3"),
      "Folded in.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add review comment" }));

    const reply = await screen.findByText("Folded in.");

    expect(within(reply.closest("article") as HTMLElement).getByText("Pending")).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      body: "Folded in.",
      pullRequestReviewId: "review-1",
      threadId: "thread-1",
    });
  });

  test("deletes a pending comment", async () => {
    await writeCachedReview(reviewWithPendingComments);
    const fetchMock = mockFetchResponse(200, { commentId: "comment-4" });

    renderReviewContainer({ tab: "comments" });

    const pendingThread = (
      await screen.findByLabelText("Reply to review thread at src/review.ts:1")
    ).closest("article") as HTMLElement;

    await userEvent.click(
      within(pendingThread).getByRole("button", { name: "Delete the pending comment by @sam" }),
    );
    await userEvent.click(
      within(pendingThread).getByRole("button", {
        name: "Confirm deleting the pending comment by @sam",
      }),
    );

    expect(await screen.findByText("Showing 1 of 1 threads")).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Review changes, 1 comment pending" }),
    ).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/local/github/pending-comment-deletions");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      commentId: "comment-4",
    });
  });

  test("keeps fetched file contents for code previews", async () => {
    await writeCachedReview({
      ...review,
      commentsCount: 1,
      files: [
        {
          additions: 1,
          deletions: 0,
          hunks: [
            {
              header: "@@ -1,2 +1,3 @@",
              id: "src/review.ts:hunk:0",
              lines: [
                context(1, 1, "const user = getUser();"),
                context(2, 2, "const ready = Boolean(user);"),
                {
                  content: "return ready;",
                  id: "src/review.ts:hunk:0:line:2",
                  newLineNumber: 3,
                  oldLineNumber: null,
                  type: "addition",
                },
              ],
              newStart: 1,
              oldStart: 1,
            },
          ],
          oldPath: "src/review.ts",
          path: "src/review.ts",
          status: "modified",
        },
      ],
      headRefOid: "a".repeat(40),
      threads: [openThread],
    });
    const fetchMock = mockFetchResponse(200, {
      content: "const user = getUser();\nconst ready = Boolean(user);\nreturn ready;\n",
    });

    const { unmount } = renderReviewContainer({ tab: "comments" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Show code around src/review.ts:3" }),
    );
    expect(await screen.findByText("Lines 2-3 of 3")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(
      await readCachedRepositoryFile(repository, 18, "a".repeat(40), "src/review.ts"),
    ).toContain("return ready;");

    unmount();
    renderReviewContainer({ tab: "comments" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Show code around src/review.ts:3" }),
    );
    expect(await screen.findByText("Lines 2-3 of 3")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

function renderReviewContainer({ tab = "files" }: { tab?: ReviewTab } = {}) {
  return renderWithProviders(
    <PullRequestReviewContainer
      backHref="/openai/pr-status/pulls"
      onTabChange={vi.fn()}
      pullRequestNumber={18}
      repository={repository}
      tab={tab}
    />,
  );
}

function writeCachedReview(data: PullRequestReviewModel) {
  return writePullRequestReviewCache(repository, 18, {
    data,
    fetchedAt: new Date("2026-04-21T09:00:00.000Z").getTime(),
  });
}

function mockFetchResponse(status: number, payload: unknown) {
  const fetchMock = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(payload), {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      }),
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function context(oldLineNumber: number, newLineNumber: number, content: string) {
  return {
    content,
    id: `src/review.ts:hunk:0:line:${newLineNumber - 1}`,
    newLineNumber,
    oldLineNumber,
    type: "context" as const,
  };
}

const repository = {
  owner: "openai",
  repo: "pr-status",
  repoInput: "openai/pr-status",
};

const review: PullRequestReviewModel = {
  additions: 1,
  changedFiles: 0,
  commentsCount: 0,
  deletions: 0,
  fileViewedStates: {},
  files: [],
  headRefOid: null,
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
    unresolvedThreads: 0,
  },
  threads: [],
  unresolvedThreads: 0,
};

const reviewFile: PullRequestDiffFile = {
  additions: 1,
  deletions: 0,
  hunks: [
    {
      header: "@@ -1,1 +1,2 @@",
      id: "src/review.ts:hunk:0",
      lines: [
        context(1, 1, "const user = getUser();"),
        {
          content: "return user;",
          id: "src/review.ts:hunk:0:line:1",
          newLineNumber: 2,
          oldLineNumber: null,
          type: "addition",
        },
      ],
      newStart: 1,
      oldStart: 1,
    },
  ],
  oldPath: "src/review.ts",
  path: "src/review.ts",
  status: "modified",
};

const openThread: PullRequestReviewThread = {
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
};

const pendingComment: PullRequestReviewComment = {
  ...openThread.comments[0]!,
  authorLogin: "sam",
  body: "Pending reply.",
  id: "comment-3",
  isPending: true,
};

// @sam has a pending reply on the open thread and a pending thread of their own.
const reviewWithPendingComments: PullRequestReviewModel = {
  ...review,
  commentsCount: 3,
  pendingReviewId: "review-1",
  threads: [
    { ...openThread, comments: [...openThread.comments, pendingComment] },
    {
      ...openThread,
      comments: [{ ...pendingComment, body: "Draft note.", id: "comment-4", line: 1 }],
      id: "thread-2",
      line: 1,
      originalLine: 1,
    },
  ],
  unresolvedThreads: 2,
};
