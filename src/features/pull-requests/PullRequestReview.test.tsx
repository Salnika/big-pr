import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { describe, expect, test, vi } from "vite-plus/test";
import { parseUnifiedDiff } from "./diff-parser";
import { PullRequestReview, type ReviewTab } from "./PullRequestReview";
import * as styles from "./PullRequestReview.css";
import type {
  CreatePullRequestReviewThreadInput,
  PullRequestDiffFile,
  PullRequestReviewComment,
  PullRequestReviewModel,
  PullRequestReviewThread,
} from "./pull-request-model";
import type { LoadFileContent } from "./ThreadCodePreview";

const headRefOid = "a".repeat(40);
const originalCommitOid = "b".repeat(40);

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

  test("filters comment threads by author", async () => {
    renderReview({
      review: {
        ...review,
        commentsCount: 4,
        threads: [
          ...review.threads,
          {
            ...review.threads[0],
            comments: [
              createComment({ authorLogin: "sam", body: "Rename this helper?", id: "comment-3" }),
              createComment({ authorLogin: "mira", body: "+1 on renaming.", id: "comment-4" }),
            ],
            id: "thread-3",
          },
        ],
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));

    const authorFilter = screen.getByRole("group", { name: "Filter comments by author" });
    const allAuthors = within(authorFilter).getByRole("button", { name: "All authors" });
    const mira = within(authorFilter).getByRole("button", { name: "mira, 2 threads" });

    expect(allAuthors.getAttribute("aria-pressed")).toBe("true");
    expect(within(authorFilter).getByRole("button", { name: "alexis, 1 thread" })).toBeTruthy();
    expect(within(mira).getByRole("presentation").getAttribute("src")).toBe(miraAvatarUrl);

    await userEvent.click(mira);

    expect(mira.getAttribute("aria-pressed")).toBe("true");
    expect(allAuthors.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Showing 2 of 2 threads")).toBeTruthy();
    expect(screen.getByText("This branch needs a guard.")).toBeTruthy();
    expect(screen.getByText("Rename this helper?")).toBeTruthy();
    expect(screen.queryByText("Looks good now.")).toBeNull();

    await userEvent.click(within(authorFilter).getByRole("button", { name: "alexis, 1 thread" }));

    expect(screen.getByText("Showing 3 of 3 threads")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Resolved" }));

    expect(within(authorFilter).getByRole("button", { name: "mira, 0 threads" })).toBeTruthy();
    expect(screen.getByText("Showing 1 of 1 threads")).toBeTruthy();

    await userEvent.click(allAuthors);

    expect(allAuthors.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Looks good now.")).toBeTruthy();
  });

  test("shows avatars, marks the PR author, and alternates messages in a thread", () => {
    renderReview({
      review: {
        ...review,
        commentsCount: 4,
        threads: [
          {
            ...review.threads[0],
            comments: [
              review.threads[0].comments[0],
              createComment({ authorLogin: "alexis", body: "Added one.", id: "comment-3" }),
              createComment({ body: "Thanks!", id: "comment-4" }),
            ],
          },
          review.threads[1],
        ],
      },
    });

    const [firstMessage, secondMessage, thirdMessage] = [
      "This branch needs a guard.",
      "Added one.",
      "Thanks!",
    ].map((body) => screen.getByText(body).closest(`.${styles.comment}`));

    expect(firstMessage?.classList.contains(styles.commentAlternate)).toBe(false);
    expect(secondMessage?.classList.contains(styles.commentAlternate)).toBe(true);
    expect(thirdMessage?.classList.contains(styles.commentAlternate)).toBe(false);
    expect(firstMessage?.querySelector("img")?.getAttribute("src")).toBe(miraAvatarUrl);
    expect(secondMessage?.querySelector("img")).toBeNull();
    expect(within(secondMessage as HTMLElement).getByText("A", { selector: "span" })).toBeTruthy();
    expect(within(secondMessage as HTMLElement).getByText("Author")).toBeTruthy();
    expect(within(firstMessage as HTMLElement).queryByText("Author")).toBeNull();
  });

  test("previews the commented code and expands it step by step", async () => {
    const openSpy = vi.spyOn(globalThis, "open").mockReturnValue(null);
    const onLoadFileContent = vi
      .fn<LoadFileContent>()
      .mockResolvedValue(`${[...longContextLines, ...extraFileLines].join("\n")}\n`);

    renderReview({ onLoadFileContent, review: createReviewWithLongCommentContext() });

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.queryByText("const beforeDrawer = true;")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Open src/review.ts:5 in VS Code" }));

    expect(openSpy).toHaveBeenCalledWith(
      "vscode://file/src/review.ts:5",
      "_blank",
      "noopener,noreferrer",
    );

    await userEvent.click(screen.getByRole("button", { name: "Show code around src/review.ts:5" }));

    const preview = screen.getByRole("region", { name: "Code around src/review.ts:5" });

    expect(getPreviewCode(preview)).toEqual([
      "const checked = isReady && user.enabled;",
      "return checked;",
      "const afterCheck = checked;",
    ]);
    expect(onLoadFileContent).toHaveBeenCalledWith({ path: "src/review.ts", ref: headRefOid });

    await userEvent.click(
      await within(preview).findByRole("button", { name: "Show 3 more lines above" }),
    );

    expect(getPreviewCode(preview)[0]).toBe("const beforeDrawer = true;");
    expect(within(preview).queryByRole("button", { name: /more lines? above/ })).toBeNull();
    expect(within(preview).getByText("Lines 1-6 of 30")).toBeTruthy();

    await userEvent.click(
      within(preview).getByRole("button", { name: "Show 10 more lines below" }),
    );

    expect(getPreviewCode(preview).at(-1)).toBe("const extra16 = 16;");

    await userEvent.click(within(preview).getByRole("button", { name: "Collapse" }));

    expect(getPreviewCode(preview)).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "src/review.ts" }));

    expect(screen.getByRole("button", { name: "PR review" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("const beforeDrawer = true;")).toBeTruthy();

    openSpy.mockRestore();
  });

  test("previews outdated threads from the code they were written on", async () => {
    const onLoadFileContent = vi
      .fn<LoadFileContent>()
      .mockResolvedValue(
        "import { ready } from './ready';\nconst guard = ready;\nexport const done = guard;\n",
      );

    renderReview({
      onLoadFileContent,
      review: {
        ...review,
        threads: [
          {
            ...review.threads[0],
            diffHunk:
              "@@ -1,2 +1,2 @@\n import { ready } from './ready';\n-const guard = true;\n+const guard = ready;",
            isOutdated: true,
            line: null,
            originalCommitOid,
            originalLine: 2,
          },
        ],
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));
    await userEvent.click(screen.getByRole("button", { name: "Show code around src/review.ts:2" }));

    const preview = screen.getByRole("region", { name: "Code around src/review.ts:2" });

    expect(within(preview).getByText("Outdated: code as it was when commented")).toBeTruthy();
    expect(getPreviewCode(preview)).toEqual([
      "const guard = true;",
      "const guard = ready;",
      "export const done = guard;",
    ]);
    expect(onLoadFileContent).toHaveBeenCalledWith({
      path: "src/review.ts",
      ref: originalCommitOid,
    });
  });

  test("falls back to the diff lines when the full file cannot be loaded", async () => {
    renderReview({
      onLoadFileContent: vi.fn<LoadFileContent>().mockRejectedValue(new Error("offline")),
      review: createReviewWithLongCommentContext(),
    });

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));
    await userEvent.click(screen.getByRole("button", { name: "Show code around src/review.ts:5" }));

    const preview = screen.getByRole("region", { name: "Code around src/review.ts:5" });

    expect(
      await within(preview).findByText("Full file unavailable, showing the diff only"),
    ).toBeTruthy();

    await userEvent.click(within(preview).getByRole("button", { name: "Show 2 more lines below" }));

    expect(getPreviewCode(preview).at(-1)).toBe("const afterDrawer = true;");
    expect(within(preview).queryByRole("button", { name: /more lines? below/ })).toBeNull();
  });

  test("shows comment reactions and toggles them", async () => {
    const onToggleReaction = vi.fn();

    renderReview({
      onToggleReaction,
      review: {
        ...review,
        threads: [
          {
            ...review.threads[0],
            comments: [
              {
                ...review.threads[0].comments[0],
                reactions: [
                  { content: "THUMBS_UP", count: 3, viewerHasReacted: true },
                  { content: "EYES", count: 1, viewerHasReacted: false },
                ],
              },
            ],
          },
          review.threads[1],
        ],
      },
    });

    const message = screen.getByText("This branch needs a guard.").closest(`.${styles.comment}`);
    const reactions = within(message as HTMLElement).getByRole("group", { name: "Reactions" });
    const thumbsUp = within(reactions).getByRole("button", { name: "thumbs up: 3" });

    expect(thumbsUp.textContent).toBe("👍3");
    expect(thumbsUp.getAttribute("aria-pressed")).toBe("true");
    expect(thumbsUp.getAttribute("title")).toBe("3 thumbs up, including you");

    await userEvent.click(thumbsUp);
    await userEvent.click(within(reactions).getByRole("button", { name: "eyes: 1" }));

    expect(onToggleReaction).toHaveBeenNthCalledWith(1, "comment-1", "THUMBS_UP", false);
    expect(onToggleReaction).toHaveBeenNthCalledWith(2, "comment-1", "EYES", true);

    await userEvent.click(
      within(message as HTMLElement).getByRole("button", { name: "Add reaction" }),
    );

    const picker = screen.getByRole("group", { name: "Pick a reaction" });

    expect(within(picker).getAllByRole("button")).toHaveLength(8);
    expect(
      within(picker)
        .getByRole("button", { name: "React with thumbs up" })
        .getAttribute("aria-pressed"),
    ).toBe("true");

    await userEvent.click(within(picker).getByRole("button", { name: "React with hooray" }));

    expect(onToggleReaction).toHaveBeenLastCalledWith("comment-1", "HOORAY", true);
    expect(screen.queryByRole("group", { name: "Pick a reaction" })).toBeNull();

    await userEvent.click(
      within(message as HTMLElement).getByRole("button", { name: "Add reaction" }),
    );
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("group", { name: "Pick a reaction" })).toBeNull();
  });

  test("disables a comment's reactions while its reaction is saved", () => {
    renderReview({
      pendingReactionCommentId: "comment-1",
      review: {
        ...review,
        threads: [
          {
            ...review.threads[0],
            comments: [
              {
                ...review.threads[0].comments[0],
                reactions: [{ content: "HEART", count: 1, viewerHasReacted: true }],
              },
            ],
          },
        ],
      },
    });

    expect(screen.getByRole("button", { name: "heart: 1" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Add reaction" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  test("marks files as viewed, folds them, and counts them", async () => {
    const onSetFileViewed = vi.fn();

    renderReview({
      onSetFileViewed,
      review: {
        ...review,
        changedFiles: 2,
        fileViewedStates: { "src/review.ts": "viewed" },
        files: [review.files[0], createDiffFile("src/components/NavBar.tsx", 2, 0)],
      },
    });

    const reviewFile = getFileArticle("src/review.ts");
    const navBarFile = getFileArticle("src/components/NavBar.tsx");

    expect(screen.getByText("1 of 2 files viewed")).toBeTruthy();
    expect(screen.getByRole("link", { name: /review\.ts/ }).getAttribute("title")).toBe(
      "src/review.ts (viewed)",
    );
    expect(
      (within(reviewFile).getByRole("checkbox", { name: "Viewed" }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(within(reviewFile).queryByText("+return true;")).toBeNull();
    expect(within(navBarFile).getByText("+return true;")).toBeTruthy();

    await userEvent.click(within(navBarFile).getByRole("checkbox", { name: "Viewed" }));

    expect(onSetFileViewed).toHaveBeenCalledWith("src/components/NavBar.tsx", true);

    await userEvent.click(within(reviewFile).getByRole("button", { name: "Expand src/review.ts" }));

    expect(within(reviewFile).getByText("+return true;")).toBeTruthy();
    expect(
      (within(reviewFile).getByRole("checkbox", { name: "Viewed" }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  test("flags viewed files that changed since", () => {
    renderReview({
      review: { ...review, fileViewedStates: { "src/review.ts": "dismissed" } },
    });

    const reviewFile = getFileArticle("src/review.ts");

    expect(within(reviewFile).getByText("Changed since last view")).toBeTruthy();
    expect(
      (within(reviewFile).getByRole("checkbox", { name: "Viewed" }) as HTMLInputElement).checked,
    ).toBe(false);
    expect(within(reviewFile).getByText("+return true;")).toBeTruthy();
  });

  test("expands unchanged lines around the diff step by step", async () => {
    const onLoadFileContent = vi
      .fn<LoadFileContent>()
      .mockResolvedValue(
        `${Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join("\n")}\n`,
      );

    renderReview({
      onLoadFileContent,
      review: { ...review, files: [expandableFile], threads: [] },
    });

    const file = getFileArticle("src/app.ts");

    expect(within(file).getByRole("button", { name: "Expand all 5 lines" })).toBeTruthy();
    expect(within(file).getByRole("button", { name: "Expand 20 lines down" })).toBeTruthy();

    await userEvent.click(within(file).getByRole("button", { name: "Expand 2 lines up" }));

    expect(await within(file).findByText("line 1")).toBeTruthy();
    expect(within(file).getByText("line 2")).toBeTruthy();
    expect(onLoadFileContent).toHaveBeenCalledWith({ path: "src/app.ts", ref: headRefOid });

    await userEvent.click(within(file).getByRole("button", { name: "Expand all 5 lines" }));

    expect(getLineNumbers(within(file).getByText("line 8"))).toEqual(["7", "8"]);
    expect(within(file).getByText("line 12")).toBeTruthy();

    await userEvent.click(within(file).getByRole("button", { name: "Expand 20 lines down" }));

    expect(within(file).getByText("line 34")).toBeTruthy();
    expect(within(file).queryByText("line 35")).toBeNull();
    expect(
      within(file).getAllByRole("button", { name: /^Expand \d+ lines? (up|down)$|^Expand all/ }),
    ).toHaveLength(1);
    expect(within(file).getByRole("button", { name: "Expand 6 lines down" })).toBeTruthy();
    expect(onLoadFileContent).toHaveBeenCalledOnce();
  });

  test("keeps plain hunk headers when the file cannot be loaded", async () => {
    renderReview({
      onLoadFileContent: vi.fn<LoadFileContent>().mockRejectedValue(new Error("offline")),
      review: { ...review, files: [expandableFile], threads: [] },
    });

    const file = getFileArticle("src/app.ts");

    await userEvent.click(within(file).getByRole("button", { name: "Expand 2 lines up" }));

    expect(await within(file).findByText("@@ -3,4 +3,5 @@")).toBeTruthy();
    expect(within(file).queryByRole("button", { name: /^Expand \d|^Expand all/ })).toBeNull();
  });

  test("approves the pull request with an optional comment", async () => {
    const onSubmitReview = vi.fn().mockResolvedValue(undefined);

    renderReview({ onSubmitReview, review: { ...review, reviewDecision: "REVIEW_REQUIRED" } });

    expect(screen.getByText("Review required")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Review changes" }));

    expect(screen.getByRole("radio", { name: /^Approve/ })).toHaveProperty("checked", true);

    await userEvent.type(screen.getByLabelText("Review summary"), "Ship it!");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(onSubmitReview).toHaveBeenCalledWith({ body: "Ship it!", event: "APPROVE" });
    expect(screen.queryByLabelText("Review summary")).toBeNull();
  });

  test("needs a summary to comment or request changes without pending comments", async () => {
    const onSubmitReview = vi.fn().mockResolvedValue(undefined);

    renderReview({ onSubmitReview });

    await userEvent.click(screen.getByRole("button", { name: "Review changes" }));
    await userEvent.click(screen.getByRole("radio", { name: /^Request changes/ }));

    const submitButton = screen.getByRole("button", { name: "Submit review" });

    expect(submitButton.hasAttribute("disabled")).toBe(true);

    await userEvent.type(screen.getByLabelText("Review summary"), "Please add a test.");
    await userEvent.click(submitButton);

    expect(onSubmitReview).toHaveBeenCalledWith({
      body: "Please add a test.",
      event: "REQUEST_CHANGES",
    });
  });

  test("shows when the viewer already approved or authored the pull request", async () => {
    const { unmount } = renderReview({
      review: { ...review, reviewDecision: "APPROVED", viewerLatestReviewState: "APPROVED" },
    });

    expect(screen.getByText("✓ You approved")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();

    unmount();
    renderReview({ review: { ...review, viewerDidAuthor: true } });

    await userEvent.click(screen.getByRole("button", { name: "Review changes" }));

    expect(screen.getByRole("radio", { name: /^Comment/ })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: /^Approve/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: /^Request changes/ }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByText("You can't approve your own pull request.")).toBeTruthy();
  });

  test("marks pending comments and filters the threads that hold them", async () => {
    renderReview({ review: createReviewWithPendingComments() });

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));
    await userEvent.click(screen.getByRole("button", { name: "Pending" }));

    expect(screen.getByText("Showing 2 of 2 threads")).toBeTruthy();

    const pendingThread = getThreadCard("src/review.ts:1");

    expect(within(pendingThread).getAllByText("Pending")).toHaveLength(2);
    expect(within(pendingThread).queryByRole("button", { name: "Resolve" })).toBeNull();
    expect(within(pendingThread).queryByRole("button", { name: "Add reaction" })).toBeNull();
    expect(within(pendingThread).queryByRole("button", { name: "Reply" })).toBeNull();
    expect(within(pendingThread).getByRole("button", { name: "Add review comment" })).toBeTruthy();

    const openThread = getThreadCard("src/review.ts:3");

    expect(within(openThread).getByText("Open")).toBeTruthy();
    expect(within(openThread).getAllByText("Pending")).toHaveLength(1);
    expect(within(openThread).getByRole("button", { name: "Resolve" })).toBeTruthy();
    expect(within(openThread).getAllByRole("button", { name: "Add reaction" })).toHaveLength(1);
  });

  test("publishes the pending comments with the submitted review", async () => {
    const onSubmitReview = vi.fn().mockResolvedValue(undefined);

    renderReview({ onSubmitReview, review: createReviewWithPendingComments() });

    await userEvent.click(
      screen.getByRole("button", { name: "Review changes, 2 comments pending" }),
    );

    expect(
      screen.getByText("2 comments pending: submitting publishes them with this review."),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: /^Comment/ })).toHaveProperty("checked", true);

    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(onSubmitReview).toHaveBeenCalledWith({ body: "", event: "COMMENT" });
  });

  test("discards the pending review once confirmed", async () => {
    const onDiscardReview = vi.fn().mockResolvedValue(undefined);

    renderReview({ onDiscardReview, review: createReviewWithPendingComments() });

    await userEvent.click(
      screen.getByRole("button", { name: "Review changes, 2 comments pending" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Discard review" }));

    expect(onDiscardReview).not.toHaveBeenCalled();
    expect(
      screen.getByText("Delete your pending review and its 2 comments? This can't be undone."),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Discard review" }));

    expect(onDiscardReview).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Review summary")).toBeNull();
  });

  test("adds replies and new comments to the pending review", async () => {
    const onCreateThread = vi.fn().mockResolvedValue(undefined);
    const onReply = vi.fn().mockResolvedValue(undefined);

    renderReview({ onCreateThread, onReply, review: createReviewWithPendingComments() });

    const openThread = getThreadCard("src/review.ts:3");
    const replyBox = within(openThread).getByLabelText("Reply to review thread at src/review.ts:3");

    await userEvent.type(replyBox, "Folded into my review.");
    await userEvent.click(within(openThread).getByRole("button", { name: "Add review comment" }));

    expect(onReply).toHaveBeenLastCalledWith("thread-1", "Folded into my review.", true);

    await userEvent.type(replyBox, "Right away, please.");
    await userEvent.click(within(openThread).getByRole("button", { name: "Reply" }));

    expect(onReply).toHaveBeenLastCalledWith("thread-1", "Right away, please.", false);
    expect(onReply).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: "Add comment on src/review.ts:3" }));

    const newComment = screen.getByLabelText("New comment on src/review.ts:3");
    const newCommentForm = newComment.closest("form") as HTMLElement;

    await userEvent.type(newComment, "One more.");

    expect(within(newCommentForm).queryByRole("button", { name: "Add single comment" })).toBeNull();

    await userEvent.click(
      within(newCommentForm).getByRole("button", { name: "Add review comment" }),
    );

    expect(onCreateThread).toHaveBeenCalledWith(expect.objectContaining({ publish: false }));
  });

  test("deletes a pending comment once confirmed", async () => {
    const onDeletePendingComment = vi.fn().mockResolvedValue(undefined);

    renderReview({ onDeletePendingComment, review: createReviewWithPendingComments() });

    const pendingThread = getThreadCard("src/review.ts:1");

    await userEvent.click(
      within(pendingThread).getByRole("button", { name: "Delete the pending comment by @sam" }),
    );

    expect(onDeletePendingComment).not.toHaveBeenCalled();

    await userEvent.click(
      within(pendingThread).getByRole("button", {
        name: "Confirm deleting the pending comment by @sam",
      }),
    );

    expect(onDeletePendingComment).toHaveBeenCalledWith("comment-4");
  });

  test("explains files without a diff and lists truncated at GitHub's limit", () => {
    renderReview({
      review: {
        ...review,
        changedFiles: 3200,
        files: [
          review.files[0],
          { ...createDiffFile("assets/logo.png", 0, 0), hunks: [], status: "added" },
        ],
      },
    });

    expect(screen.getByRole("note").textContent).toContain(
      "Showing the first 2 of 3200 changed files",
    );
    expect(
      within(getFileArticle("assets/logo.png")).getByText(/No diff to show for this file/),
    ).toBeTruthy();
  });

  test("renders the diffs of large pull requests as they approach the viewport", () => {
    const observers: Array<{ callback: IntersectionObserverCallback; target: Element | null }> = [];

    vi.stubGlobal(
      "IntersectionObserver",
      class {
        private readonly entry: { callback: IntersectionObserverCallback; target: Element | null };

        constructor(callback: IntersectionObserverCallback) {
          this.entry = { callback, target: null };
          observers.push(this.entry);
        }

        disconnect() {}

        observe(target: Element) {
          this.entry.target = target;
        }
      },
    );

    renderReview({
      review: {
        ...review,
        changedFiles: 60,
        files: Array.from({ length: 60 }, (_, index) =>
          createDiffFile(`src/file-${index}.ts`, 1, 1),
        ),
        threads: [],
      },
    });

    const file = getFileArticle("src/file-12.ts");

    expect(within(file).queryByText("+return true;")).toBeNull();

    const observer = observers.find((entry) => entry.target === file);

    act(() => {
      observer?.callback(
        [{ isIntersecting: true, target: file } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(within(file).getByText("+return true;")).toBeTruthy();
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

    expect(onReply).toHaveBeenCalledTimes(1);
    expect(onReply).toHaveBeenCalledWith("thread-1", "Added the guard.", false);
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
    await userEvent.click(screen.getByRole("button", { name: "Add single comment" }));

    expect(onCreateThread).toHaveBeenCalledWith({
      body: "Can we simplify this branch?",
      line: 3,
      path: "src/review.ts",
      publish: true,
      pullRequestId: "pr-1",
      side: "RIGHT",
    });
  });

  test("starts a review from a diff line", async () => {
    const onCreateThread = vi.fn().mockResolvedValue(undefined);

    renderReview({ onCreateThread });

    await userEvent.click(screen.getByRole("button", { name: "Add comment on src/review.ts:3" }));
    await userEvent.type(screen.getByLabelText("New comment on src/review.ts:3"), "Draft.");
    await userEvent.click(screen.getByRole("button", { name: "Start a review" }));

    expect(onCreateThread).toHaveBeenCalledWith(expect.objectContaining({ publish: false }));
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
    onDeletePendingComment: (commentId: string) => Promise<unknown>;
    onDiscardReview: () => Promise<unknown>;
    onLoadFileContent: LoadFileContent;
    onReply: ComponentProps<typeof PullRequestReview>["onReply"];
    onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
    onSubmitReview: ComponentProps<typeof PullRequestReview>["onSubmitReview"];
    onSetFileViewed: (path: string, viewed: boolean) => void;
    onToggleReaction: ComponentProps<typeof PullRequestReview>["onToggleReaction"];
    pendingReactionCommentId: string | null;
    pendingViewedFilePaths: string[];
    review: PullRequestReviewModel;
  }> = {},
) {
  return render(
    <ReviewWithTabs
      backHref="/openai/pr-status/pulls"
      fetchedAt={null}
      isDiscardingReview={false}
      isRefreshing={false}
      isSubmittingReview={false}
      mutationError={null}
      onCreateThread={overrides.onCreateThread ?? vi.fn().mockResolvedValue(undefined)}
      onDeletePendingComment={
        overrides.onDeletePendingComment ?? vi.fn().mockResolvedValue(undefined)
      }
      onDiscardReview={overrides.onDiscardReview ?? vi.fn().mockResolvedValue(undefined)}
      onLoadFileContent={
        overrides.onLoadFileContent ??
        vi.fn<LoadFileContent>().mockRejectedValue(new Error("Not available in this test."))
      }
      onRefresh={vi.fn()}
      onReply={overrides.onReply ?? vi.fn().mockResolvedValue(undefined)}
      onSetFileViewed={overrides.onSetFileViewed ?? vi.fn()}
      onSetResolved={overrides.onSetResolved ?? vi.fn().mockResolvedValue(undefined)}
      onSubmitReview={overrides.onSubmitReview ?? vi.fn().mockResolvedValue(undefined)}
      onToggleReaction={overrides.onToggleReaction ?? vi.fn()}
      pendingCreateThread={null}
      pendingDeleteCommentId={null}
      pendingReactionCommentId={overrides.pendingReactionCommentId ?? null}
      pendingReplyThreadId={null}
      pendingResolutionThreadId={null}
      pendingViewedFilePaths={overrides.pendingViewedFilePaths ?? []}
      review={overrides.review ?? review}
    />,
  );
}

// The app drives the tab from the URL; tests only need it to follow the tab buttons.
function ReviewWithTabs(
  props: Omit<ComponentProps<typeof PullRequestReview>, "onTabChange" | "tab">,
) {
  const [tab, setTab] = useState<ReviewTab>("files");

  return <PullRequestReview {...props} onTabChange={setTab} tab={tab} />;
}

function getFileArticle(path: string) {
  const collapseButton = screen.getByRole("button", {
    name: new RegExp(`^(Collapse|Expand) ${path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`),
  });

  return collapseButton.closest("article") as HTMLElement;
}

function getThreadCard(location: string) {
  return screen
    .getByLabelText(`Reply to review thread at ${location}`)
    .closest("article") as HTMLElement;
}

function getLineNumbers(code: HTMLElement) {
  const row = code.closest("pre")?.parentElement;

  return Array.from(row?.children ?? [])
    .slice(1, 3)
    .map((cell) => cell.textContent);
}

function getPreviewCode(preview: HTMLElement) {
  return Array.from(preview.querySelectorAll("pre"), (line) => line.lastChild?.textContent);
}

function createComment(overrides: Partial<PullRequestReviewComment>): PullRequestReviewComment {
  return {
    ...review.threads[0].comments[0],
    ...overrides,
    authorAvatarUrl:
      overrides.authorAvatarUrl ?? (overrides.authorLogin === "mira" ? miraAvatarUrl : null),
  };
}

// The viewer (@sam) has a pending reply on an open thread and a pending thread of their own.
function createReviewWithPendingComments(): PullRequestReviewModel {
  const [openThread, resolvedThread] = review.threads;

  return {
    ...review,
    commentsCount: 4,
    pendingReviewId: "review-1",
    threads: [
      {
        ...openThread,
        comments: [
          ...openThread.comments,
          createComment({
            authorLogin: "sam",
            body: "Pending reply.",
            id: "comment-3",
            isPending: true,
          }),
        ],
      },
      resolvedThread,
      {
        ...openThread,
        comments: [
          createComment({
            authorLogin: "sam",
            body: "Draft note on the signature.",
            id: "comment-4",
            isPending: true,
            line: 1,
            originalLine: 1,
          }),
        ],
        id: "thread-3",
        line: 1,
        originalLine: 1,
      },
    ],
    unresolvedThreads: 2,
  };
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

function createReviewThreads(count: number): PullRequestReviewThread[] {
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

const longContextLines = [
  "const beforeDrawer = true;",
  "const user = getUser();",
  "const isReady = Boolean(user);",
  "const checked = isReady && user.enabled;",
  "return checked;",
  "const afterCheck = checked;",
  "trackReview(afterCheck);",
  "const afterDrawer = true;",
];
const extraFileLines = Array.from(
  { length: 22 },
  (_, index) => `const extra${index + 9} = ${index + 9};`,
);

function createReviewWithLongCommentContext(): PullRequestReviewModel {
  const lines = longContextLines.map((content, index) => ({
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

const miraAvatarUrl = "https://avatars.githubusercontent.com/u/2?s=64&v=4";

const review: PullRequestReviewModel = {
  additions: 1,
  changedFiles: 1,
  commentsCount: 2,
  deletions: 1,
  fileViewedStates: {},
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
  headRefOid,
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
  threads: [
    {
      id: "thread-1",
      comments: [
        {
          id: "comment-1",
          authorAvatarUrl: miraAvatarUrl,
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
    {
      id: "thread-2",
      comments: [
        {
          id: "comment-2",
          authorAvatarUrl: null,
          authorLogin: "alexis",
          body: "Looks good now.",
          createdAt: "2026-04-21T09:20:00.000Z",
          isPending: false,
          line: 2,
          originalLine: 2,
          path: "src/review.ts",
          reactions: [],
          replyToId: null,
          url: "https://github.com/openai/pr-status/pull/18#discussion_r2",
        },
      ],
      diffHunk: null,
      diffSide: "RIGHT",
      isOutdated: false,
      isResolved: true,
      line: 2,
      originalCommitOid: null,
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

const expandableFile = parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -3,4 +3,5 @@
 line 3
 line 4
-old 5
+line 5
+line 6
 line 7
@@ -12,3 +13,2 @@
 line 13
-old 13
 line 14
`)[0] as PullRequestDiffFile;
