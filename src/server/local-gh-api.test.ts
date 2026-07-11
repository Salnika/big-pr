import { describe, expect, test, vi } from "vite-plus/test";
import {
  createReviewThread,
  getGithubCliStatus,
  getPullRequestReview,
  getPullRequestsOverview,
  replyToReviewThread,
  setReviewThreadResolved,
} from "./local-gh-api";

describe("local gh api", () => {
  test("reads an authenticated gh status", async () => {
    const status = await getGithubCliStatus(
      vi.fn().mockResolvedValue({
        stderr: "",
        stdout: JSON.stringify({
          hosts: {
            "github.com": [
              {
                active: true,
                host: "github.com",
                login: "alexis",
                state: "ok",
              },
            ],
          },
        }),
      }),
    );

    expect(status).toEqual({
      authenticated: true,
      cliAvailable: true,
      host: "github.com",
      login: "alexis",
      message: "Connected locally as @alexis through gh.",
    });
  });

  test("surfaces an invalid gh auth session", async () => {
    const status = await getGithubCliStatus(
      vi.fn().mockResolvedValue({
        stderr: "",
        stdout: JSON.stringify({
          hosts: {
            "github.com": [
              {
                active: true,
                error: "The token in default is invalid",
                host: "github.com",
                login: "alexis",
                state: "error",
              },
            ],
          },
        }),
      }),
    );

    expect(status.authenticated).toBe(false);
    expect(status.message).toContain("gh auth login -h github.com");
  });

  test("maps a gh graphql response into the dashboard overview", async () => {
    const runGh = vi
      .fn()
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequests: {
                totalCount: 1,
                pageInfo: { endCursor: null, hasNextPage: false },
                nodes: [
                  {
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
                    statusCheckRollup: { state: "SUCCESS" },
                    title: "Ship the dashboard",
                    updatedAt: "2026-04-21T09:00:00.000Z",
                    url: "https://github.com/openai/pr-status/pull/42",
                  },
                ],
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pr_42: {
                id: "pr_1",
                reviewThreads: {
                  nodes: [{ isResolved: false, isOutdated: false }],
                  pageInfo: { hasNextPage: false },
                },
              },
            },
          },
        }),
      });

    const overview = await getPullRequestsOverview({ owner: "openai", repo: "pr-status" }, runGh);

    expect(overview).toEqual({
      hasMore: false,
      items: [
        {
          id: "pr_1",
          number: 42,
          title: "Ship the dashboard",
          url: "https://github.com/openai/pr-status/pull/42",
          authorLogin: "alexis",
          baseBranch: "main",
          headBranch: "dashboard",
          repositoryName: "openai/pr-status",
          updatedAt: "2026-04-21T09:00:00.000Z",
          isDraft: false,
          ciStatus: "success",
          hasConflicts: false,
          unresolvedThreads: 1,
        },
      ],
      totalCount: 1,
    });
    expect(runGh).toHaveBeenCalledTimes(2);
  });

  test("maps gh authentication failures into a typed local error", async () => {
    await expect(
      getPullRequestsOverview(
        { owner: "openai", repo: "pr-status" },
        vi.fn().mockRejectedValue(
          Object.assign(new Error("authentication failed"), {
            stderr: "gh: authentication failed (HTTP 401)",
          }),
        ),
      ),
    ).rejects.toMatchObject({
      status: 401,
      type: "auth",
    });
  });

  test("loads a pull request review with parsed diff and review comments", async () => {
    const runGh = vi
      .fn()
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                additions: 1,
                author: { login: "alexis" },
                baseRefName: "main",
                changedFiles: 1,
                deletions: 1,
                headRefName: "dashboard",
                id: "pr_42",
                isDraft: false,
                mergeStateStatus: "CLEAN",
                mergeable: "MERGEABLE",
                number: 42,
                repository: {
                  nameWithOwner: "openai/pr-status",
                },
                reviewThreads: {
                  nodes: [
                    {
                      id: "thread_1",
                      comments: {
                        nodes: [
                          {
                            author: { login: "mira" },
                            body: "Please guard this branch.",
                            createdAt: "2026-04-21T09:10:00.000Z",
                            id: "comment_1",
                            line: 2,
                            originalLine: 2,
                            path: "src/app.ts",
                            replyTo: null,
                            url: "https://github.com/openai/pr-status/pull/42#discussion_r1",
                          },
                        ],
                      },
                      diffSide: "RIGHT",
                      isOutdated: false,
                      isResolved: false,
                      line: 2,
                      originalLine: 2,
                      originalStartLine: null,
                      path: "src/app.ts",
                      resolvedBy: null,
                      startDiffSide: null,
                      startLine: null,
                    },
                  ],
                  pageInfo: { hasNextPage: false },
                },
                statusCheckRollup: { state: "SUCCESS" },
                title: "Ship the dashboard",
                updatedAt: "2026-04-21T09:00:00.000Z",
                url: "https://github.com/openai/pr-status/pull/42",
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        stderr: "",
        stdout: `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,2 @@
-const ready = false;
+const ready = true;
`,
      });

    const review = await getPullRequestReview(
      { number: 42, owner: "openai", repo: "pr-status" },
      runGh,
    );

    expect(review.pullRequest.number).toBe(42);
    expect(review.files[0]?.path).toBe("src/app.ts");
    expect(review.threads[0]?.comments[0]?.body).toBe("Please guard this branch.");
    expect(review.unresolvedThreads).toBe(1);
    expect(runGh).toHaveBeenCalledTimes(2);
    expect(runGh.mock.calls[1]?.[0]).toContain("Accept: application/vnd.github.v3.diff");
  });

  test("loads paginated review threads for the pull request detail view", async () => {
    const runGh = vi
      .fn()
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                additions: 1,
                author: { login: "alexis" },
                baseRefName: "main",
                changedFiles: 1,
                deletions: 1,
                headRefName: "dashboard",
                id: "pr_42",
                isDraft: false,
                mergeStateStatus: "CLEAN",
                mergeable: "MERGEABLE",
                number: 42,
                repository: {
                  nameWithOwner: "openai/pr-status",
                },
                reviewThreads: {
                  nodes: [
                    {
                      comments: { nodes: [] },
                      diffSide: "RIGHT",
                      id: "thread_resolved",
                      isOutdated: false,
                      isResolved: true,
                      line: 2,
                      originalLine: 2,
                      originalStartLine: null,
                      path: "src/app.ts",
                      resolvedBy: { login: "alexis" },
                      startDiffSide: null,
                      startLine: null,
                    },
                  ],
                  pageInfo: { endCursor: "cursor-1", hasNextPage: true },
                },
                statusCheckRollup: { state: "SUCCESS" },
                title: "Ship the dashboard",
                updatedAt: "2026-04-21T09:00:00.000Z",
                url: "https://github.com/openai/pr-status/pull/42",
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        stderr: "",
        stdout: "",
      })
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    {
                      comments: { nodes: [] },
                      diffSide: "RIGHT",
                      id: "thread_open",
                      isOutdated: false,
                      isResolved: false,
                      line: 4,
                      originalLine: 4,
                      originalStartLine: null,
                      path: "src/app.ts",
                      resolvedBy: null,
                      startDiffSide: null,
                      startLine: null,
                    },
                  ],
                  pageInfo: { endCursor: null, hasNextPage: false },
                },
              },
            },
          },
        }),
      });

    const review = await getPullRequestReview(
      { number: 42, owner: "openai", repo: "pr-status" },
      runGh,
    );

    expect(review.threads.map((thread) => thread.id)).toEqual(["thread_resolved", "thread_open"]);
    expect(review.unresolvedThreads).toBe(1);
    expect(runGh).toHaveBeenCalledTimes(3);
    expect(runGh.mock.calls[2]?.[0]?.at(-1)).toContain('after: "cursor-1"');
  });

  test("sends review replies and resolution mutations through gh graphql", async () => {
    const runGh = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({
        data: {
          addPullRequestReviewThreadReply: {
            comment: { id: "comment_2" },
          },
          resolveReviewThread: {
            thread: { id: "thread_1", isResolved: true },
          },
        },
      }),
    });

    await replyToReviewThread({ body: "Fixed in the latest commit.", threadId: "thread_1" }, runGh);
    await setReviewThreadResolved({ isResolved: true, threadId: "thread_1" }, runGh);

    expect(runGh.mock.calls[0]?.[0]).toContain("body=Fixed in the latest commit.");
    expect(runGh.mock.calls[0]?.[0]?.at(-1)).toContain("addPullRequestReviewThreadReply");
    expect(runGh.mock.calls[1]?.[0]).toContain("threadId=thread_1");
    expect(runGh.mock.calls[1]?.[0]?.at(-1)).toContain("resolveReviewThread");
  });

  test("creates a new pull request review thread through gh graphql", async () => {
    const runGh = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({
        data: {
          addPullRequestReviewThread: {
            thread: { id: "thread_2" },
          },
        },
      }),
    });

    await createReviewThread(
      {
        body: "Can we simplify this branch?",
        line: 12,
        path: "src/app.ts",
        pullRequestId: "pr_42",
        side: "RIGHT",
      },
      runGh,
    );

    expect(runGh.mock.calls[0]?.[0]).toContain("body=Can we simplify this branch?");
    expect(runGh.mock.calls[0]?.[0]).toContain("line=12");
    expect(runGh.mock.calls[0]?.[0]).toContain("path=src/app.ts");
    expect(runGh.mock.calls[0]?.[0]).toContain("pullRequestId=pr_42");
    expect(runGh.mock.calls[0]?.[0]).toContain("side=RIGHT");
    expect(runGh.mock.calls[0]?.[0]?.at(-1)).toContain("addPullRequestReviewThread");
  });

  test("paginates pull requests and retries a temporary 502 from gh", async () => {
    const runGh = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("bad gateway"), {
          stderr: "gh: HTTP 502",
        }),
      )
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequests: {
                totalCount: 2,
                pageInfo: { endCursor: "cursor-1", hasNextPage: true },
                nodes: [
                  {
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
                    statusCheckRollup: { state: "SUCCESS" },
                    title: "Ship the dashboard",
                    updatedAt: "2026-04-21T09:00:00.000Z",
                    url: "https://github.com/openai/pr-status/pull/42",
                  },
                ],
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequests: {
                totalCount: 2,
                pageInfo: { endCursor: null, hasNextPage: false },
                nodes: [
                  {
                    author: { login: "mira" },
                    baseRefName: "release",
                    headRefName: "fix-release-branch",
                    id: "pr_2",
                    isDraft: true,
                    mergeStateStatus: "DIRTY",
                    mergeable: "CONFLICTING",
                    number: 43,
                    repository: {
                      nameWithOwner: "openai/pr-status",
                    },
                    statusCheckRollup: { state: "FAILURE" },
                    title: "Fix the release branch",
                    updatedAt: "2026-04-21T10:00:00.000Z",
                    url: "https://github.com/openai/pr-status/pull/43",
                  },
                ],
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pr_42: {
                id: "pr_1",
                reviewThreads: {
                  nodes: [{ isResolved: false, isOutdated: false }],
                  pageInfo: { hasNextPage: false },
                },
              },
              pr_43: {
                id: "pr_2",
                reviewThreads: {
                  nodes: [{ isResolved: false, isOutdated: false }],
                  pageInfo: { hasNextPage: true },
                },
              },
            },
          },
        }),
      });

    const overview = await getPullRequestsOverview({ owner: "openai", repo: "pr-status" }, runGh);

    expect(overview).toEqual({
      hasMore: false,
      items: [
        {
          id: "pr_1",
          number: 42,
          title: "Ship the dashboard",
          url: "https://github.com/openai/pr-status/pull/42",
          authorLogin: "alexis",
          baseBranch: "main",
          headBranch: "dashboard",
          repositoryName: "openai/pr-status",
          updatedAt: "2026-04-21T09:00:00.000Z",
          isDraft: false,
          ciStatus: "success",
          hasConflicts: false,
          unresolvedThreads: 1,
        },
        {
          id: "pr_2",
          number: 43,
          title: "Fix the release branch",
          url: "https://github.com/openai/pr-status/pull/43",
          authorLogin: "mira",
          baseBranch: "release",
          headBranch: "fix-release-branch",
          repositoryName: "openai/pr-status",
          updatedAt: "2026-04-21T10:00:00.000Z",
          isDraft: true,
          ciStatus: "failure",
          hasConflicts: true,
          unresolvedThreads: 100,
        },
      ],
      totalCount: 2,
    });
    expect(runGh).toHaveBeenCalledTimes(4);
    expect(runGh.mock.calls[2]?.[0]?.at(-1)).toContain('after: "cursor-1"');
  });
});
