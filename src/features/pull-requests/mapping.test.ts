import { describe, expect, test } from "vite-plus/test";
import {
  countUnresolvedThreads,
  hasPullRequestConflicts,
  mapCiStatus,
  mapFileViewedState,
  mapPullRequest,
  mapReactionGroups,
  mapReviewDecision,
  mapReviewState,
  mapReviewThread,
} from "./mapping";

describe("pull request mapping", () => {
  test("maps CI status values", () => {
    expect(mapCiStatus("SUCCESS")).toBe("success");
    expect(mapCiStatus("PENDING")).toBe("pending");
    expect(mapCiStatus("FAILURE")).toBe("failure");
    expect(mapCiStatus(null)).toBe("unknown");
  });

  test("detects conflicts from merge signals", () => {
    expect(
      hasPullRequestConflicts({
        mergeable: "CONFLICTING",
        mergeStateStatus: "DIRTY",
      }),
    ).toBe(true);

    expect(
      hasPullRequestConflicts({
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
      }),
    ).toBe(false);
  });

  test("counts unresolved review threads and caps paginated results", () => {
    expect(
      countUnresolvedThreads({
        nodes: [
          { isResolved: false, isOutdated: false },
          { isResolved: true, isOutdated: false },
          { isResolved: false, isOutdated: true },
        ],
        pageInfo: {
          hasNextPage: false,
        },
      }),
    ).toBe(1);

    expect(
      countUnresolvedThreads({
        nodes: [{ isResolved: false, isOutdated: false }],
        pageInfo: {
          hasNextPage: true,
        },
      }),
    ).toBe(100);
  });

  test("maps a GitHub pull request into the UI model", () => {
    const rawPullRequest: Parameters<typeof mapPullRequest>[0] = {
      author: { login: "alexis" },
      baseRefName: "main",
      headRefName: "dashboard",
      id: "pr_1",
      isDraft: false,
      mergeStateStatus: "CLEAN",
      mergeable: "MERGEABLE",
      number: 42,
      repository: {
        nameWithOwner: "openai/pr-status",
      },
      reviewThreads: {
        nodes: [{ isResolved: false, isOutdated: false }],
        pageInfo: { hasNextPage: false },
      },
      statusCheckRollup: { state: "SUCCESS" },
      title: "Ship the dashboard",
      updatedAt: "2026-04-21T09:00:00.000Z",
      url: "https://github.com/openai/pr-status/pull/42",
    };

    expect(mapPullRequest(rawPullRequest)).toEqual({
      id: "pr_1",
      number: 42,
      title: "Ship the dashboard",
      url: "https://github.com/openai/pr-status/pull/42",
      authorAvatarUrl: null,
      authorLogin: "alexis",
      baseBranch: "main",
      headBranch: "dashboard",
      repositoryName: "openai/pr-status",
      updatedAt: "2026-04-21T09:00:00.000Z",
      isDraft: false,
      ciStatus: "success",
      hasConflicts: false,
      unresolvedThreads: 1,
    });
  });

  test("keeps only known review decisions and states", () => {
    expect(mapReviewDecision("CHANGES_REQUESTED")).toBe("CHANGES_REQUESTED");
    expect(mapReviewDecision("SOMETHING_NEW")).toBeNull();
    expect(mapReviewDecision(null)).toBeNull();
    expect(mapReviewState("APPROVED")).toBe("APPROVED");
    expect(mapReviewState(undefined)).toBeNull();
  });

  test("maps GitHub's viewed file states", () => {
    expect(mapFileViewedState("VIEWED")).toBe("viewed");
    expect(mapFileViewedState("DISMISSED")).toBe("dismissed");
    expect(mapFileViewedState("UNVIEWED")).toBe("unviewed");
  });

  test("keeps used reactions in GitHub's order", () => {
    expect(
      mapReactionGroups([
        { content: "EYES", reactors: { totalCount: 1 }, viewerHasReacted: false },
        { content: "LAUGH", reactors: { totalCount: 0 }, viewerHasReacted: false },
        { content: "THUMBS_UP", reactors: { totalCount: 4 }, viewerHasReacted: true },
        { content: "UNKNOWN", reactors: { totalCount: 9 }, viewerHasReacted: false },
      ]),
    ).toEqual([
      { content: "THUMBS_UP", count: 4, viewerHasReacted: true },
      { content: "EYES", count: 1, viewerHasReacted: false },
    ]);
    expect(mapReactionGroups(null)).toEqual([]);
  });

  test("maps review thread avatars and the diff hunk of the first comment", () => {
    const thread = mapReviewThread({
      comments: {
        nodes: [
          {
            author: {
              avatarUrl: "https://avatars.githubusercontent.com/u/1?s=64&v=4",
              login: "mira",
            },
            body: "Please guard this branch.",
            createdAt: "2026-04-21T09:10:00.000Z",
            id: "comment_1",
            line: null,
            originalLine: 2,
            path: "src/app.ts",
            replyTo: null,
            url: "https://github.com/openai/pr-status/pull/42#discussion_r1",
          },
          {
            author: null,
            body: "Done.",
            createdAt: "2026-04-21T09:20:00.000Z",
            id: "comment_2",
            line: null,
            originalLine: 2,
            path: null,
            replyTo: { id: "comment_1" },
            url: "https://github.com/openai/pr-status/pull/42#discussion_r2",
          },
        ],
      },
      diffSide: "RIGHT",
      id: "thread_1",
      isOutdated: true,
      isResolved: false,
      line: null,
      originalLine: 2,
      path: "src/app.ts",
      rootComment: {
        nodes: [
          {
            diffHunk: "@@ -1,2 +1,2 @@\n-const ready = false;\n+const ready = true;",
            originalCommit: { oid: "b".repeat(40) },
          },
        ],
      },
    });

    expect(
      thread.comments.map((comment) => [comment.authorLogin, comment.authorAvatarUrl]),
    ).toEqual([
      ["mira", "https://avatars.githubusercontent.com/u/1?s=64&v=4"],
      ["ghost", null],
    ]);
    expect(thread.diffHunk).toBe("@@ -1,2 +1,2 @@\n-const ready = false;\n+const ready = true;");
    expect(thread.originalCommitOid).toBe("b".repeat(40));
  });
});
