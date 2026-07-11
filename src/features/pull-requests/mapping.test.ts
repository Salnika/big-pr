import { describe, expect, test } from "vite-plus/test";
import {
  countUnresolvedThreads,
  hasPullRequestConflicts,
  mapCiStatus,
  mapPullRequest,
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
});
