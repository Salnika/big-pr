import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vite-plus/test";
import { PullRequestReview } from "./PullRequestReview";
import type {
  CreatePullRequestReviewThreadInput,
  PullRequestDiffFile,
  PullRequestReviewModel,
} from "./pull-request-model";

describe("PullRequestReview", () => {
  test("renders diff comments inline and switches to the comments-only view", async () => {
    renderReview();

    expect(screen.getAllByText("src/review.ts").length).toBeGreaterThan(0);
    expect(screen.getByText("This branch needs a guard.")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));

    expect(screen.getByRole("button", { name: "Open" }).getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "src/review.ts" })).toBeTruthy();
    expect(screen.getByText(":3")).toBeTruthy();
    expect(screen.queryByText("Looks good now.")).toBeNull();
  });

  test("renders markdown in review comments", () => {
    renderReview({
      review: {
        ...review,
        threads: [
          {
            ...review.threads[0],
            comments: [
              {
                ...review.threads[0].comments[0],
                body: [
                  "This branch needs **a guard** and `tests`.",
                  "",
                  "- Keep CI green",
                  "",
                  "Read [docs](https://example.com).",
                ].join("\n"),
              },
            ],
          },
          review.threads[1],
        ],
      },
    });

    const strongText = screen.getByText("a guard");
    const inlineCode = screen.getByText("tests");
    const listItem = screen.getByText("Keep CI green");
    const link = screen.getByRole("link", { name: "docs" });

    expect(strongText.tagName).toBe("STRONG");
    expect(inlineCode.tagName).toBe("CODE");
    expect(listItem.closest("li")).toBeTruthy();
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  test("opens and expands code from the comments-only view", async () => {
    const openSpy = vi.spyOn(globalThis, "open").mockReturnValue(null);

    renderReview({ review: createReviewWithLongCommentContext() });

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.queryByText("const beforeDrawer = true;")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Open src/review.ts:5 in VS Code" }));

    expect(openSpy).toHaveBeenCalledWith(
      "vscode://file/src/review.ts:5",
      "_blank",
      "noopener,noreferrer",
    );

    await userEvent.click(screen.getByRole("button", { name: "Show code around src/review.ts:5" }));

    expect(screen.getByText("return checked;")).toBeTruthy();
    expect(screen.queryByText("const beforeDrawer = true;")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("const beforeDrawer = true;")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Collapse" }));

    expect(screen.queryByText("const beforeDrawer = true;")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "src/review.ts" }));

    expect(screen.getByRole("button", { name: "PR review" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("const beforeDrawer = true;")).toBeTruthy();

    openSpy.mockRestore();
  });

  test("renders changed files as a searchable tree", async () => {
    renderReview({
      review: {
        ...review,
        changedFiles: 3,
        files: [
          review.files[0],
          createDiffFile("src/components/NavBar.tsx", 2, 0),
          createDiffFile("docs/usage.md", 0, 1),
        ],
      },
    });

    expect(screen.getByRole("button", { name: "Collapse src" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse src/components" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /NavBar\.tsx/ })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Collapse src" }));

    expect(screen.getByRole("button", { name: "Expand src" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /NavBar\.tsx/ })).toBeNull();

    await userEvent.type(screen.getByRole("searchbox", { name: "Search files by name" }), "nav");

    expect(screen.getByRole("button", { name: "Collapse src" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /NavBar\.tsx/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /review\.ts/ })).toBeNull();
  });

  test("submits replies and toggles thread resolution", async () => {
    const onReply = vi.fn().mockResolvedValue(undefined);
    const onSetResolved = vi.fn().mockResolvedValue(undefined);

    renderReview({ onReply, onSetResolved });

    await userEvent.type(
      screen.getByLabelText("Reply to review thread at src/review.ts:3"),
      "Added the guard.",
    );
    const replyButtons = screen.getAllByRole("button", { name: "Reply" });
    await userEvent.click(replyButtons.find((button) => !button.hasAttribute("disabled"))!);
    await userEvent.click(screen.getByRole("button", { name: "Resolve" }));

    expect(onReply).toHaveBeenCalledWith("thread-1", "Added the guard.");
    expect(onSetResolved).toHaveBeenCalledWith("thread-1", true);
  });

  test("creates a new review thread from a diff line", async () => {
    const onCreateThread = vi.fn().mockResolvedValue(undefined);

    renderReview({ onCreateThread });

    await userEvent.click(screen.getByRole("button", { name: "Add comment on src/review.ts:3" }));
    await userEvent.type(
      screen.getByLabelText("New comment on src/review.ts:3"),
      "Can we simplify this branch?",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add comment" }));

    expect(onCreateThread).toHaveBeenCalledWith({
      body: "Can we simplify this branch?",
      line: 3,
      path: "src/review.ts",
      pullRequestId: "pr-1",
      side: "RIGHT",
    });
  });

  test("paginates the comments-only thread list", async () => {
    renderReview({
      review: {
        ...review,
        commentsCount: 22,
        threads: createReviewThreads(22),
        unresolvedThreads: 22,
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));

    expect(screen.getByText("Showing 20 of 22 threads")).toBeTruthy();
    expect(screen.getByText("src/review-20.ts")).toBeTruthy();
    expect(screen.getByText(":20")).toBeTruthy();
    expect(screen.queryByText("src/review-21.ts")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Load more comments" }));

    expect(screen.getByText("Showing 22 of 22 threads")).toBeTruthy();
    expect(screen.getByText("src/review-21.ts")).toBeTruthy();
    expect(screen.getByText("src/review-22.ts")).toBeTruthy();
  });
});

function renderReview(
  overrides: Partial<{
    onCreateThread: (input: CreatePullRequestReviewThreadInput) => Promise<unknown>;
    onReply: (threadId: string, body: string) => Promise<unknown>;
    onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
    review: PullRequestReviewModel;
  }> = {},
) {
  return render(
    <PullRequestReview
      isRefreshing={false}
      mutationError={null}
      onBack={vi.fn()}
      onCreateThread={overrides.onCreateThread ?? vi.fn().mockResolvedValue(undefined)}
      onRefresh={vi.fn()}
      onReply={overrides.onReply ?? vi.fn().mockResolvedValue(undefined)}
      onSetResolved={overrides.onSetResolved ?? vi.fn().mockResolvedValue(undefined)}
      pendingCreateThread={null}
      pendingReplyThreadId={null}
      pendingResolutionThreadId={null}
      review={overrides.review ?? review}
    />,
  );
}

function createDiffFile(path: string, additions: number, deletions: number): PullRequestDiffFile {
  return {
    ...review.files[0],
    additions,
    deletions,
    hunks: review.files[0].hunks.map((hunk, hunkIndex) => ({
      ...hunk,
      id: `${path}:hunk:${hunkIndex}`,
      lines: hunk.lines.map((line, lineIndex) => ({
        ...line,
        id: `${path}:hunk:${hunkIndex}:line:${lineIndex}`,
      })),
    })),
    oldPath: path,
    path,
  };
}

function createReviewThreads(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const threadNumber = index + 1;

    return {
      ...review.threads[0],
      id: `thread-${threadNumber}`,
      comments: [
        {
          ...review.threads[0].comments[0],
          body: `Comment ${threadNumber}`,
          id: `comment-${threadNumber}`,
          line: threadNumber,
          originalLine: threadNumber,
          path: `src/review-${threadNumber}.ts`,
        },
      ],
      line: threadNumber,
      originalLine: threadNumber,
      path: `src/review-${threadNumber}.ts`,
    };
  });
}

function createReviewWithLongCommentContext(): PullRequestReviewModel {
  const lines = [
    "const beforeDrawer = true;",
    "const user = getUser();",
    "const isReady = Boolean(user);",
    "const checked = isReady && user.enabled;",
    "return checked;",
    "const afterCheck = checked;",
    "trackReview(afterCheck);",
    "const afterDrawer = true;",
  ].map((content, index) => ({
    content,
    id: `src/review.ts:hunk:0:line:${index}`,
    newLineNumber: index + 1,
    oldLineNumber: index + 1,
    type: "context" as const,
  }));

  return {
    ...review,
    commentsCount: 1,
    files: [
      {
        ...review.files[0],
        hunks: [
          {
            id: "src/review.ts:hunk:0",
            header: "@@ -1,8 +1,8 @@",
            lines,
            newStart: 1,
            oldStart: 1,
          },
        ],
      },
    ],
    threads: [
      {
        ...review.threads[0],
        comments: [
          {
            ...review.threads[0].comments[0],
            line: 5,
            originalLine: 5,
          },
        ],
        line: 5,
        originalLine: 5,
      },
    ],
    unresolvedThreads: 1,
  };
}

const review: PullRequestReviewModel = {
  additions: 1,
  changedFiles: 1,
  commentsCount: 2,
  deletions: 1,
  files: [
    {
      additions: 1,
      deletions: 1,
      hunks: [
        {
          id: "src/review.ts:hunk:0",
          header: "@@ -1,3 +1,3 @@",
          newStart: 1,
          oldStart: 1,
          lines: [
            {
              id: "src/review.ts:hunk:0:line:0",
              content: "export function review() {",
              newLineNumber: 1,
              oldLineNumber: 1,
              type: "context",
            },
            {
              id: "src/review.ts:hunk:0:line:1",
              content: "return false;",
              newLineNumber: null,
              oldLineNumber: 2,
              type: "deletion",
            },
            {
              id: "src/review.ts:hunk:0:line:2",
              content: "return true;",
              newLineNumber: 2,
              oldLineNumber: null,
              type: "addition",
            },
            {
              id: "src/review.ts:hunk:0:line:3",
              content: "}",
              newLineNumber: 3,
              oldLineNumber: 3,
              type: "context",
            },
          ],
        },
      ],
      oldPath: "src/review.ts",
      path: "src/review.ts",
      status: "modified",
    },
  ],
  pullRequest: {
    id: "pr-1",
    number: 18,
    title: "Review a large PR",
    url: "https://github.com/openai/pr-status/pull/18",
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
          authorLogin: "mira",
          body: "This branch needs a guard.",
          createdAt: "2026-04-21T09:10:00.000Z",
          line: 3,
          originalLine: 3,
          path: "src/review.ts",
          replyToId: null,
          url: "https://github.com/openai/pr-status/pull/18#discussion_r1",
        },
      ],
      diffSide: "RIGHT",
      isOutdated: false,
      isResolved: false,
      line: 3,
      originalLine: 3,
      originalStartLine: null,
      path: "src/review.ts",
      resolvedByLogin: null,
      startDiffSide: null,
      startLine: null,
    },
    {
      id: "thread-2",
      comments: [
        {
          id: "comment-2",
          authorLogin: "alexis",
          body: "Looks good now.",
          createdAt: "2026-04-21T09:20:00.000Z",
          line: 2,
          originalLine: 2,
          path: "src/review.ts",
          replyToId: null,
          url: "https://github.com/openai/pr-status/pull/18#discussion_r2",
        },
      ],
      diffSide: "RIGHT",
      isOutdated: false,
      isResolved: true,
      line: 2,
      originalLine: 2,
      originalStartLine: null,
      path: "src/review.ts",
      resolvedByLogin: "alexis",
      startDiffSide: null,
      startLine: null,
    },
  ],
  unresolvedThreads: 1,
};
