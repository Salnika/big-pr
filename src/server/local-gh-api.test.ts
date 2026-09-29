import { describe, expect, test, vi } from "vite-plus/test";
import {
  createReviewThread,
  deletePendingComment,
  discardPendingReview,
  getGithubCliStatus,
  getPullRequestReview,
  getPullRequestsOverview,
  getRepositoryFileContent,
  replyToReviewThread,
  setCommentReaction,
  setFileViewed,
  setReviewThreadResolved,
  submitReview,
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
                author: {
                  avatarUrl: "https://avatars.githubusercontent.com/u/1?s=64&v=4",
                  login: "alexis",
                },
                baseRefName: "main",
                changedFiles: 1,
                deletions: 1,
                headRefName: "dashboard",
                files: {
                  nodes: [{ path: "src/app.ts", viewerViewedState: "VIEWED" }],
                  pageInfo: { endCursor: null, hasNextPage: false },
                },
                reviewDecision: "REVIEW_REQUIRED",
                viewerDidAuthor: true,
                viewerLatestReview: { state: "COMMENTED" },
                headRefOid: "a".repeat(40),
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
                            author: {
                              avatarUrl: "https://avatars.githubusercontent.com/u/2?s=64&v=4",
                              login: "mira",
                            },
                            body: "Please guard this branch.",
                            createdAt: "2026-04-21T09:10:00.000Z",
                            id: "comment_1",
                            line: 2,
                            originalLine: 2,
                            path: "src/app.ts",
                            reactionGroups: [
                              {
                                content: "HEART",
                                reactors: { totalCount: 2 },
                                viewerHasReacted: true,
                              },
                              {
                                content: "THUMBS_UP",
                                reactors: { totalCount: 0 },
                                viewerHasReacted: false,
                              },
                            ],
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
                      rootComment: {
                        nodes: [
                          {
                            diffHunk:
                              "@@ -1,2 +1,2 @@\n-const ready = false;\n+const ready = true;",
                            originalCommit: { oid: "a".repeat(40) },
                          },
                        ],
                      },
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
    expect(review.pullRequest.authorAvatarUrl).toBe(
      "https://avatars.githubusercontent.com/u/1?s=64&v=4",
    );
    expect(review.headRefOid).toBe("a".repeat(40));
    expect(review.fileViewedStates).toEqual({ "src/app.ts": "viewed" });
    expect(review).toMatchObject({
      reviewDecision: "REVIEW_REQUIRED",
      viewerDidAuthor: true,
      viewerLatestReviewState: "COMMENTED",
    });
    expect(review.files[0]?.path).toBe("src/app.ts");
    expect(review.threads[0]?.comments[0]).toMatchObject({
      authorAvatarUrl: "https://avatars.githubusercontent.com/u/2?s=64&v=4",
      body: "Please guard this branch.",
    });
    expect(review.threads[0]?.comments[0]?.reactions).toEqual([
      { content: "HEART", count: 2, viewerHasReacted: true },
    ]);
    expect(review.threads[0]?.diffHunk).toContain("+const ready = true;");
    expect(review.threads[0]?.originalCommitOid).toBe("a".repeat(40));
    expect(runGh.mock.calls[0]?.[0]?.at(-1)).toContain("rootComment: comments(first: 1)");
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
            comment: {
              author: { avatarUrl: null, login: "alexis" },
              body: "Fixed in the latest commit.",
              createdAt: "2026-04-21T09:30:00.000Z",
              id: "comment_2",
              line: 2,
              originalLine: 2,
              path: "src/app.ts",
              replyTo: { id: "comment_1" },
              url: "https://github.com/openai/pr-status/pull/42#discussion_r2",
            },
          },
          resolveReviewThread: {
            thread: { id: "thread_1", isResolved: true, resolvedBy: { login: "alexis" } },
          },
        },
      }),
    });

    const reply = await replyToReviewThread(
      { body: "Fixed in the latest commit.", threadId: "thread_1" },
      runGh,
    );
    const resolution = await setReviewThreadResolved(
      { isResolved: true, threadId: "thread_1" },
      runGh,
    );

    expect(reply).toEqual({
      comment: {
        id: "comment_2",
        authorAvatarUrl: null,
        authorLogin: "alexis",
        body: "Fixed in the latest commit.",
        createdAt: "2026-04-21T09:30:00.000Z",
        isPending: false,
        line: 2,
        originalLine: 2,
        path: "src/app.ts",
        reactions: [],
        replyToId: "comment_1",
        url: "https://github.com/openai/pr-status/pull/42#discussion_r2",
      },
      pendingReviewId: null,
      threadId: "thread_1",
    });
    expect(resolution).toEqual({
      isResolved: true,
      resolvedByLogin: "alexis",
      threadId: "thread_1",
    });
    expect(runGh.mock.calls[0]?.[0]).toContain("body=Fixed in the latest commit.");
    expect(runGh.mock.calls[0]?.[0]?.at(-1)).toContain("addPullRequestReviewThreadReply");
    expect(runGh.mock.calls[1]?.[0]).toContain("threadId=thread_1");
    expect(runGh.mock.calls[1]?.[0]?.at(-1)).toContain("resolveReviewThread");
  });

  test("adds a reply to the viewer's pending review", async () => {
    const runGh = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({
        data: {
          addPullRequestReviewThreadReply: {
            comment: {
              ...createRawComment("comment_4", "Will fold this in."),
              pullRequestReview: { id: "review_7" },
              state: "PENDING",
            },
          },
        },
      }),
    });

    const reply = await replyToReviewThread(
      { body: "Will fold this in.", pullRequestReviewId: "review_7", threadId: "thread_1" },
      runGh,
    );

    expect(runGh.mock.calls[0]?.[0]).toContain("pullRequestReviewId=review_7");
    expect(reply.pendingReviewId).toBe("review_7");
    expect(reply.comment.isPending).toBe(true);
  });

  test("creates a new pull request review thread in the pending review", async () => {
    const runGh = createThreadRunner(1);

    const result = await createReviewThread(
      {
        body: "Can we simplify this branch?",
        line: 12,
        path: "src/app.ts",
        publish: false,
        pullRequestId: "pr_42",
        side: "RIGHT",
      },
      runGh,
    );

    expect(runGh).toHaveBeenCalledOnce();
    expect(runGh.mock.calls[0]?.[0]).toContain("body=Can we simplify this branch?");
    expect(runGh.mock.calls[0]?.[0]).toContain("line=12");
    expect(runGh.mock.calls[0]?.[0]).toContain("path=src/app.ts");
    expect(runGh.mock.calls[0]?.[0]).toContain("pullRequestId=pr_42");
    expect(runGh.mock.calls[0]?.[0]).toContain("side=RIGHT");
    expect(runGh.mock.calls[0]?.[0]?.at(-1)).toContain("addPullRequestReviewThread");
    expect(result.pendingReviewId).toBe("review_3");
    expect(result.thread).toMatchObject({
      id: "thread_2",
      isResolved: false,
      line: 12,
      path: "src/app.ts",
    });
    expect(result.thread.comments[0]).toMatchObject({
      body: "Can we simplify this branch?",
      isPending: true,
    });
  });

  test("publishes a single comment by submitting the review it started", async () => {
    const runGh = createThreadRunner(1);

    const result = await createReviewThread(
      {
        body: "Can we simplify this branch?",
        line: 12,
        path: "src/app.ts",
        publish: true,
        pullRequestId: "pr_42",
        side: "RIGHT",
      },
      runGh,
    );

    expect(runGh).toHaveBeenCalledTimes(2);
    expect(runGh.mock.calls[1]?.[0]?.at(-1)).toContain("submitPullRequestReview");
    expect(runGh.mock.calls[1]?.[0]).toContain("pullRequestReviewId=review_3");
    expect(runGh.mock.calls[1]?.[0]).toContain("event=COMMENT");
    expect(result.pendingReviewId).toBeNull();
    expect(result.thread.comments[0]?.isPending).toBe(false);
  });

  test("never submits a pending review that already held other comments", async () => {
    const runGh = createThreadRunner(3);

    const result = await createReviewThread(
      {
        body: "Can we simplify this branch?",
        line: 12,
        path: "src/app.ts",
        publish: true,
        pullRequestId: "pr_42",
        side: "RIGHT",
      },
      runGh,
    );

    expect(runGh).toHaveBeenCalledOnce();
    expect(result.pendingReviewId).toBe("review_3");
    expect(result.thread.comments[0]?.isPending).toBe(true);
  });

  test("loads every page of the viewer's viewed files", async () => {
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
                changedFiles: 2,
                deletions: 1,
                files: {
                  nodes: [{ path: "src/a.ts", viewerViewedState: "VIEWED" }],
                  pageInfo: { endCursor: "files-1", hasNextPage: true },
                },
                headRefName: "dashboard",
                id: "pr_42",
                isDraft: false,
                mergeStateStatus: "CLEAN",
                mergeable: "MERGEABLE",
                number: 42,
                repository: { nameWithOwner: "openai/pr-status" },
                reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
                statusCheckRollup: { state: "SUCCESS" },
                title: "Ship the dashboard",
                updatedAt: "2026-04-21T09:00:00.000Z",
                url: "https://github.com/openai/pr-status/pull/42",
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({ stderr: "", stdout: "" })
      .mockResolvedValueOnce({
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                files: {
                  nodes: [{ path: "src/b.ts", viewerViewedState: "DISMISSED" }],
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

    expect(review.fileViewedStates).toEqual({ "src/a.ts": "viewed", "src/b.ts": "dismissed" });
    expect(runGh.mock.calls[2]?.[0]?.at(-1)).toContain('files(first: 100, after: "files-1")');
  });

  test("loads the remaining viewed-state pages together when cursors are offsets", async () => {
    const createNodes = (from: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        path: `src/file-${from + index}.ts`,
        viewerViewedState: (from + index) % 2 ? "VIEWED" : "UNVIEWED",
      }));
    const runGh = vi.fn(async (args: string[]) => {
      const query = args.at(-1) ?? "";

      if (args.includes("Accept: application/vnd.github.v3.diff")) {
        return { stderr: "", stdout: "" };
      }

      if (query.includes("PullRequestFilesPage")) {
        const offset = Number(atob(query.match(/after: "([^"]+)"/)?.[1] ?? ""));

        return {
          stderr: "",
          stdout: JSON.stringify({
            data: {
              repository: {
                pullRequest: {
                  files: {
                    nodes: createNodes(offset, Math.min(100, 250 - offset)),
                    pageInfo: {
                      endCursor: btoa(String(offset + 100)),
                      hasNextPage: offset + 100 < 250,
                    },
                    totalCount: 250,
                  },
                },
              },
            },
          }),
        };
      }

      return {
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                additions: 250,
                author: { login: "alexis" },
                baseRefName: "main",
                changedFiles: 250,
                deletions: 0,
                files: {
                  nodes: createNodes(0, 100),
                  pageInfo: { endCursor: "MTAw", hasNextPage: true },
                  totalCount: 250,
                },
                headRefName: "many-files",
                id: "pr_42",
                isDraft: false,
                mergeStateStatus: "CLEAN",
                mergeable: "MERGEABLE",
                number: 42,
                repository: { nameWithOwner: "openai/pr-status" },
                reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
                statusCheckRollup: { state: "SUCCESS" },
                title: "Touch many files",
                updatedAt: "2026-04-21T09:00:00.000Z",
                url: "https://github.com/openai/pr-status/pull/42",
              },
            },
          },
        }),
      };
    });

    const review = await getPullRequestReview(
      { number: 42, owner: "openai", repo: "pr-status" },
      runGh,
    );
    const pageCursors = runGh.mock.calls
      .map(([args]) => args.at(-1) ?? "")
      .filter((query) => query.includes("PullRequestFilesPage"))
      .map((query) => query.match(/after: "([^"]+)"/)?.[1]);

    expect(Object.keys(review.fileViewedStates)).toHaveLength(250);
    expect(review.fileViewedStates["src/file-249.ts"]).toBe("viewed");
    expect(pageCursors).toEqual(["MTAw", "MjAw"]);
  });

  test("loads per-file patches when GitHub refuses the diff of a PR over 300 files", async () => {
    const files = Array.from({ length: 150 }, (_, index) => ({
      additions: 1,
      deletions: 0,
      filename: `src/file-${index + 1}.ts`,
      patch: "@@ -0,0 +1 @@\n+export {};",
      status: "added",
    }));
    const runGh = vi.fn(async (args: string[]) => {
      const endpoint = args[1] ?? "";

      if (args.includes("Accept: application/vnd.github.v3.diff")) {
        throw Object.assign(new Error("Command failed"), {
          stderr:
            "gh: Sorry, the diff exceeded the maximum number of files (300). (HTTP 406) " +
            '{"errors":[{"resource":"PullRequest","field":"diff","code":"too_large"}]}',
        });
      }

      if (endpoint.includes("/files?")) {
        const page = Number(new URL(endpoint, "https://api.github.com").searchParams.get("page"));

        return { stderr: "", stdout: JSON.stringify(files.slice((page - 1) * 100, page * 100)) };
      }

      return {
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                additions: 150,
                author: { login: "alexis" },
                baseRefName: "main",
                changedFiles: 150,
                deletions: 0,
                headRefName: "huge",
                id: "pr_42",
                isDraft: false,
                mergeStateStatus: "CLEAN",
                mergeable: "MERGEABLE",
                number: 42,
                repository: { nameWithOwner: "openai/pr-status" },
                reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
                statusCheckRollup: { state: "SUCCESS" },
                title: "Touch every file",
                updatedAt: "2026-04-21T09:00:00.000Z",
                url: "https://github.com/openai/pr-status/pull/42",
              },
            },
          },
        }),
      };
    });

    const review = await getPullRequestReview(
      { number: 42, owner: "openai", repo: "pr-status" },
      runGh,
    );
    const fileRequests = runGh.mock.calls
      .map(([args]) => args[1] ?? "")
      .filter((endpoint) => endpoint.includes("/files?"));

    expect(review.files).toHaveLength(150);
    expect(review.files[149]).toMatchObject({ path: "src/file-150.ts", status: "added" });
    expect(review.files[0]?.hunks[0]?.lines[0]?.content).toBe("export {};");
    expect(fileRequests).toEqual([
      "repos/openai/pr-status/pulls/42/files?per_page=100&page=1",
      "repos/openai/pr-status/pulls/42/files?per_page=100&page=2",
    ]);
  });

  test("submits a new review or the pending one with its comments", async () => {
    const createRunner = (pendingReviewId: string | null, state: string) => {
      const submission = {
        pullRequestReview: { pullRequest: { reviewDecision: "APPROVED" }, state },
      };

      return vi.fn(async (args: string[]) => ({
        stderr: "",
        stdout: JSON.stringify({
          data: args.at(-1)?.includes("PendingReview")
            ? { node: { reviews: { nodes: pendingReviewId ? [{ id: pendingReviewId }] : [] } } }
            : { addPullRequestReview: submission, submitPullRequestReview: submission },
        }),
      }));
    };
    const withoutPendingReview = createRunner(null, "APPROVED");
    const withPendingReview = createRunner("review_7", "COMMENTED");

    expect(
      await submitReview(
        { body: "  Ship it!  ", event: "APPROVE", pullRequestId: "pr_42" },
        withoutPendingReview,
      ),
    ).toEqual({ reviewDecision: "APPROVED", viewerLatestReviewState: "APPROVED" });
    expect(withoutPendingReview.mock.calls[1]?.[0]).toContain("pullRequestId=pr_42");
    expect(withoutPendingReview.mock.calls[1]?.[0]).toContain("event=APPROVE");
    expect(withoutPendingReview.mock.calls[1]?.[0]).toContain("body=Ship it!");
    expect(withoutPendingReview.mock.calls[1]?.[0]?.at(-1)).toContain("addPullRequestReview");

    expect(
      await submitReview({ body: "", event: "COMMENT", pullRequestId: "pr_42" }, withPendingReview),
    ).toEqual({ reviewDecision: "APPROVED", viewerLatestReviewState: "COMMENTED" });
    expect(withPendingReview.mock.calls[1]?.[0]).toContain("pullRequestReviewId=review_7");
    expect(withPendingReview.mock.calls[1]?.[0]).toContain("event=COMMENT");
    expect(withPendingReview.mock.calls[1]?.[0]?.some((arg) => arg.startsWith("body="))).toBe(
      false,
    );
    expect(withPendingReview.mock.calls[1]?.[0]?.at(-1)).toContain("submitPullRequestReview");
  });

  test("refuses review types GitHub does not know", async () => {
    const runGh = vi.fn();

    await expect(
      submitReview({ body: "", event: "MERGE", pullRequestId: "pr_42" }, runGh),
    ).rejects.toMatchObject({ status: 400 });
    expect(runGh).not.toHaveBeenCalled();
  });

  test("discards the pending review", async () => {
    const runGh = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({
        data: { deletePullRequestReview: { pullRequestReview: { id: "review_7" } } },
      }),
    });

    expect(await discardPendingReview({ pullRequestReviewId: "review_7" }, runGh)).toEqual({
      pullRequestReviewId: "review_7",
    });
    expect(runGh.mock.calls[0]?.[0]).toContain("pullRequestReviewId=review_7");
    expect(runGh.mock.calls[0]?.[0]?.at(-1)).toContain("deletePullRequestReview");
  });

  test("deletes pending comments only", async () => {
    const createRunner = (state: string) =>
      vi.fn(async (args: string[]) => ({
        stderr: "",
        stdout: JSON.stringify({
          data: args.at(-1)?.includes("ReviewCommentState")
            ? { node: { state } }
            : { deletePullRequestReviewComment: { clientMutationId: null } },
        }),
      }));
    const pending = createRunner("PENDING");
    const published = createRunner("SUBMITTED");

    expect(await deletePendingComment({ commentId: "comment_4" }, pending)).toEqual({
      commentId: "comment_4",
    });
    expect(pending.mock.calls[1]?.[0]).toContain("commentId=comment_4");
    expect(pending.mock.calls[1]?.[0]?.at(-1)).toContain("deletePullRequestReviewComment");

    await expect(deletePendingComment({ commentId: "comment_1" }, published)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(published).toHaveBeenCalledOnce();
  });

  test("marks and unmarks files as viewed through gh graphql", async () => {
    const runGh = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({
        data: {
          markFileAsViewed: { pullRequest: { id: "pr_42" } },
          unmarkFileAsViewed: { pullRequest: { id: "pr_42" } },
        },
      }),
    });

    expect(
      await setFileViewed({ path: "src/app.ts", pullRequestId: "pr_42", viewed: true }, runGh),
    ).toEqual({ path: "src/app.ts", viewedState: "viewed" });
    expect(
      await setFileViewed({ path: "src/app.ts", pullRequestId: "pr_42", viewed: false }, runGh),
    ).toEqual({ path: "src/app.ts", viewedState: "unviewed" });
    expect(runGh.mock.calls[0]?.[0]).toContain("pullRequestId=pr_42");
    expect(runGh.mock.calls[0]?.[0]).toContain("path=src/app.ts");
    expect(runGh.mock.calls[0]?.[0]?.at(-1)).toContain("markFileAsViewed");
    expect(runGh.mock.calls[1]?.[0]?.at(-1)).toContain("unmarkFileAsViewed");
  });

  test("adds and removes comment reactions through gh graphql", async () => {
    const runGh = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({
        data: {
          addReaction: {
            reactionGroups: [
              { content: "ROCKET", reactors: { totalCount: 1 }, viewerHasReacted: true },
              { content: "EYES", reactors: { totalCount: 0 }, viewerHasReacted: false },
            ],
          },
          removeReaction: {
            reactionGroups: [
              { content: "ROCKET", reactors: { totalCount: 0 }, viewerHasReacted: false },
            ],
          },
        },
      }),
    });

    const added = await setCommentReaction(
      { commentId: "comment_1", content: "ROCKET", hasReacted: true },
      runGh,
    );
    const removed = await setCommentReaction(
      { commentId: "comment_1", content: "ROCKET", hasReacted: false },
      runGh,
    );

    expect(added).toEqual({
      commentId: "comment_1",
      reactions: [{ content: "ROCKET", count: 1, viewerHasReacted: true }],
    });
    expect(removed).toEqual({ commentId: "comment_1", reactions: [] });
    expect(runGh.mock.calls[0]?.[0]).toContain("subjectId=comment_1");
    expect(runGh.mock.calls[0]?.[0]).toContain("content=ROCKET");
    expect(runGh.mock.calls[0]?.[0]?.at(-1)).toContain("addReaction");
    expect(runGh.mock.calls[1]?.[0]?.at(-1)).toContain("removeReaction");
  });

  test("rejects reactions GitHub does not support", async () => {
    const runGh = vi.fn();

    await expect(
      setCommentReaction({ commentId: "comment_1", content: "PARTY", hasReacted: true }, runGh),
    ).rejects.toMatchObject({ status: 400 });
    expect(runGh).not.toHaveBeenCalled();
  });

  test("loads raw file content at a commit through gh", async () => {
    const runGh = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: "const ready = true;\n",
    });

    const file = await getRepositoryFileContent(
      { owner: "openai", path: "src/my file#1.ts", ref: "a".repeat(40), repo: "pr-status" },
      runGh,
    );

    expect(file).toEqual({ content: "const ready = true;\n" });
    expect(runGh).toHaveBeenCalledWith([
      "api",
      `repos/openai/pr-status/contents/src/my%20file%231.ts?ref=${"a".repeat(40)}`,
      "-H",
      "Accept: application/vnd.github.raw+json",
    ]);
  });

  test("rejects file content requests outside the repository", async () => {
    const runGh = vi.fn();

    for (const input of [
      { owner: "openai", path: "../../user", ref: "a".repeat(40), repo: "pr-status" },
      { owner: "openai", path: "src/app.ts", ref: "main", repo: "pr-status" },
      { owner: "..", path: "src/app.ts", ref: "a".repeat(40), repo: "pr-status" },
    ]) {
      await expect(getRepositoryFileContent(input, runGh)).rejects.toMatchObject({ status: 400 });
    }

    expect(runGh).not.toHaveBeenCalled();
  });

  test("paginates pull requests and retries a temporary 502 from gh", async () => {
    let hasFailedOnce = false;
    const runGh = createPullRequestsRunner(() => {
      if (!hasFailedOnce) {
        hasFailedOnce = true;
        throw Object.assign(new Error("bad gateway"), { stderr: "gh: HTTP 502" });
      }
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
        },
        {
          id: "pr_2",
          number: 43,
          title: "Fix the release branch",
          url: "https://github.com/openai/pr-status/pull/43",
          authorAvatarUrl: null,
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
    expect(runGh).toHaveBeenCalledTimes(5);
    expect(getQueries(runGh).filter((query) => query.includes('after: "cursor-1"'))).toHaveLength(
      1,
    );
  });

  test("reports each page as soon as its thread counts arrive", async () => {
    const runGh = createPullRequestsRunner();
    const progress: Array<{ expectedCount: number; numbers: number[] }> = [];

    await getPullRequestsOverview({ owner: "openai", repo: "pr-status" }, runGh, (update) =>
      progress.push({
        expectedCount: update.expectedCount,
        numbers: update.overview.items.map((item) => item.number),
      }),
    );

    expect(progress).toEqual([
      { expectedCount: 2, numbers: [42] },
      { expectedCount: 2, numbers: [42, 43] },
    ]);
    // The first page's thread counts are requested before the second page.
    expect(getQueries(runGh).map(getQueryKind)).toEqual([
      "page:first",
      "threads:pr_42",
      "page:cursor-1",
      "threads:pr_43",
    ]);
  });

  test("stops reporting progress once a page fails", async () => {
    const runGh = createPullRequestsRunner(async (query) => {
      if (query.includes("pr_42:")) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      if (query.includes('after: "cursor-1"')) {
        throw Object.assign(new Error("authentication failed"), {
          stderr: "gh: authentication failed (HTTP 401)",
        });
      }
    });
    const onProgress = vi.fn();

    await expect(
      getPullRequestsOverview({ owner: "openai", repo: "pr-status" }, runGh, onProgress),
    ).rejects.toMatchObject({ status: 401, type: "auth" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(onProgress).not.toHaveBeenCalled();
  });
});

// Answers gh calls by query instead of call order, since thread counts load while the next page does.
function createPullRequestsRunner(beforeEach: (query: string) => Promise<void> | void = () => {}) {
  return vi.fn(async (args: string[]) => {
    const query = args.at(-1) ?? "";

    await beforeEach(query);

    if (query.includes("PullRequestReviewThreads")) {
      return {
        stderr: "",
        stdout: JSON.stringify({
          data: {
            repository: query.includes("pr_42:")
              ? {
                  pr_42: {
                    id: "pr_1",
                    reviewThreads: {
                      nodes: [{ isResolved: false, isOutdated: false }],
                      pageInfo: { hasNextPage: false },
                    },
                  },
                }
              : {
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
      };
    }

    const isSecondPage = query.includes('after: "cursor-1"');

    return {
      stderr: "",
      stdout: JSON.stringify({
        data: {
          repository: {
            pullRequests: {
              totalCount: 2,
              pageInfo: isSecondPage
                ? { endCursor: null, hasNextPage: false }
                : { endCursor: "cursor-1", hasNextPage: true },
              nodes: [
                isSecondPage
                  ? {
                      author: { login: "mira" },
                      baseRefName: "release",
                      headRefName: "fix-release-branch",
                      id: "pr_2",
                      isDraft: true,
                      mergeStateStatus: "DIRTY",
                      mergeable: "CONFLICTING",
                      number: 43,
                      repository: { nameWithOwner: "openai/pr-status" },
                      statusCheckRollup: { state: "FAILURE" },
                      title: "Fix the release branch",
                      updatedAt: "2026-04-21T10:00:00.000Z",
                      url: "https://github.com/openai/pr-status/pull/43",
                    }
                  : {
                      author: { login: "alexis" },
                      baseRefName: "main",
                      headRefName: "dashboard",
                      id: "pr_1",
                      isDraft: false,
                      mergeStateStatus: "CLEAN",
                      mergeable: "MERGEABLE",
                      number: 42,
                      repository: { nameWithOwner: "openai/pr-status" },
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
    };
  });
}

function getQueries(runGh: ReturnType<typeof createPullRequestsRunner>) {
  return runGh.mock.calls.map(([args]) => args.at(-1) ?? "");
}

function getQueryKind(query: string) {
  if (query.includes("PullRequestReviewThreads")) {
    return query.includes("pr_42:") ? "threads:pr_42" : "threads:pr_43";
  }

  return query.includes('after: "cursor-1"') ? "page:cursor-1" : "page:first";
}

function createRawComment(id: string, body: string) {
  return {
    author: { avatarUrl: null, login: "alexis" },
    body,
    createdAt: "2026-04-21T09:30:00.000Z",
    id,
    line: 12,
    originalLine: 12,
    path: "src/app.ts",
    replyTo: null,
    url: `https://github.com/openai/pr-status/pull/42#discussion_${id}`,
  };
}

// The new thread lands in the viewer's pending review, which holds `reviewCommentCount` comments.
function createThreadRunner(reviewCommentCount: number) {
  return vi.fn(async (args: string[]) => ({
    stderr: "",
    stdout: JSON.stringify({
      data: args.at(-1)?.includes("submitPullRequestReview")
        ? {
            submitPullRequestReview: {
              pullRequestReview: { pullRequest: { reviewDecision: null }, state: "COMMENTED" },
            },
          }
        : {
            addPullRequestReviewThread: {
              thread: {
                comments: {
                  nodes: [
                    {
                      ...createRawComment("comment_3", "Can we simplify this branch?"),
                      pullRequestReview: { id: "review_3" },
                      state: "PENDING",
                    },
                  ],
                },
                diffSide: "RIGHT",
                firstCommentReview: {
                  nodes: [
                    {
                      pullRequestReview: {
                        comments: { totalCount: reviewCommentCount },
                        id: "review_3",
                      },
                    },
                  ],
                },
                id: "thread_2",
                isOutdated: false,
                isResolved: false,
                line: 12,
                originalLine: 12,
                originalStartLine: null,
                path: "src/app.ts",
                resolvedBy: null,
                startDiffSide: null,
                startLine: null,
              },
            },
          },
    }),
  }));
}
