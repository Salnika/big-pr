import { describe, expect, test, vi } from "vite-plus/test";
import { fetchPullRequests, GitHubApiError } from "./github-client";
import type { PullRequestsSyncEvent } from "./pull-request-model";

const settings = { owner: "openai", repo: "pr-status", repoInput: "openai/pr-status" };

describe("github client", () => {
  test("reports streamed pull request updates, even when lines arrive in pieces", async () => {
    const lines = [
      event({ expectedCount: 2, overview: overview([42]), type: "progress" }),
      event({ expectedCount: 2, overview: overview([42, 43]), type: "progress" }),
      event({ overview: overview([42, 43]), type: "done" }),
    ].join("");
    // Split mid-line to mimic network chunks.
    mockStreamResponse([lines.slice(0, 25), lines.slice(25, 300), lines.slice(300)]);
    const onProgress = vi.fn();

    const result = await fetchPullRequests(settings, { onProgress });

    expect(onProgress.mock.calls.map(([progress]) => progress.overview.items.length)).toEqual([
      1, 2,
    ]);
    expect(result.items.map((item) => item.number)).toEqual([42, 43]);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({
      Accept: "application/x-ndjson, application/json",
    });
  });

  test("turns a streamed error into a GitHub API error", async () => {
    mockStreamResponse([
      event({ expectedCount: 20, overview: overview([42]), type: "progress" }),
      event({
        error: { message: "GitHub timed out.", status: 502, type: "network" },
        type: "error",
      }),
    ]);

    await expect(fetchPullRequests(settings)).rejects.toMatchObject({
      message: "GitHub timed out.",
      status: 502,
      type: "network",
    });
  });

  test("fails when the stream ends before the list is complete", async () => {
    mockStreamResponse([event({ expectedCount: 20, overview: overview([42]), type: "progress" })]);

    await expect(fetchPullRequests(settings)).rejects.toBeInstanceOf(GitHubApiError);
  });
});

function mockStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder();

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }, status: 200 },
      ),
    ),
  );
}

function event(value: PullRequestsSyncEvent) {
  return `${JSON.stringify(value)}\n`;
}

function overview(numbers: number[]) {
  return {
    hasMore: false,
    items: numbers.map((number) => ({
      id: `pr_${number}`,
      number,
      title: `PR ${number}`,
      url: `https://github.com/openai/pr-status/pull/${number}`,
      authorAvatarUrl: null,
      authorLogin: "alexis",
      baseBranch: "main",
      headBranch: `branch-${number}`,
      repositoryName: "openai/pr-status",
      updatedAt: "2026-04-21T09:00:00.000Z",
      isDraft: false,
      ciStatus: "success" as const,
      hasConflicts: false,
      unresolvedThreads: 0,
    })),
    totalCount: numbers.length,
  };
}
