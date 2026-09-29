import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vite-plus/test";
import { PrGridContainer } from "./PrGridContainer";
import type { PullRequestCardModel, PullRequestsSyncEvent } from "./pull-request-model";
import { readPullRequestsCache, writePullRequestsCache } from "./pull-requests-cache";
import { renderWithProviders } from "../../test/render-with-providers";

describe("PrGridContainer", () => {
  test("does not fetch pull requests until the list is fetched", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderGridContainer();

    expect(await screen.findByText("No saved pull requests")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fetch PR list" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("shows a local gh auth error state after fetching", async () => {
    mockFetchResponse(401, {
      message:
        "Your local gh session is not authenticated. Run `gh auth login -h github.com` and retry.",
      status: 401,
      type: "auth",
    });

    renderGridContainer();
    await userEvent.click(await screen.findByRole("button", { name: "Fetch PR list" }));

    expect(await screen.findByText("GitHub CLI needs login")).toBeTruthy();
  });

  test("shows a repository access error state after fetching", async () => {
    mockFetchResponse(404, {
      message: "This repository could not be found or is not accessible through gh.",
      status: 404,
      type: "repo",
    });

    renderGridContainer();
    await userEvent.click(await screen.findByRole("button", { name: "Fetch PR list" }));

    expect(await screen.findByText("Repository not accessible")).toBeTruthy();
  });

  test("shows an empty state when no open pull requests exist after fetching", async () => {
    mockFetchResponse(200, {
      hasMore: false,
      items: [],
      totalCount: 0,
    });

    renderGridContainer();
    await userEvent.click(await screen.findByRole("button", { name: "Fetch PR list" }));

    expect(await screen.findByText("No open pull requests")).toBeTruthy();
  });

  test("renders the PR grid on success, links to reviews, and saves the list", async () => {
    mockFetchResponse(200, {
      hasMore: false,
      items: [pullRequest],
      totalCount: 1,
    });

    renderGridContainer();
    await userEvent.click(await screen.findByRole("button", { name: "Fetch PR list" }));

    expect(await screen.findByText("Launch the PR dashboard")).toBeTruthy();
    expect(screen.getByText("1 open pull requests")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh PR list" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe(
      "/openai/pr-status/pull/21/files",
    );
    await waitFor(async () => {
      expect((await readPullRequestsCache(repository))?.data.items[0]?.number).toBe(21);
    });
  });

  test("renders cached pull requests without refreshing in the background", async () => {
    await writePullRequestsCache(repository, {
      data: {
        hasMore: false,
        items: [{ ...pullRequest, headBranch: "cache-refresh", title: "Use cached pull requests" }],
        totalCount: 1,
      },
      fetchedAt: new Date("2026-04-21T09:00:00.000Z").getTime(),
    });
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    renderGridContainer();

    expect(await screen.findByText("Use cached pull requests")).toBeTruthy();
    expect(screen.getByText("cache-refresh")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("shows pull requests as soon as the first page arrives", async () => {
    const stream = mockStreamingFetch();

    renderGridContainer();
    await userEvent.click(await screen.findByRole("button", { name: "Fetch PR list" }));

    expect(await screen.findByText("Loading pull requests")).toBeTruthy();

    stream.push({
      expectedCount: 2,
      overview: { hasMore: false, items: [pullRequest], totalCount: 2 },
      type: "progress",
    });

    expect(await screen.findByText("Launch the PR dashboard")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "Synchronising… 1 of 2 pull requests updated",
    );
    expect(await readPullRequestsCache(repository)).toBeNull();

    stream.push({
      overview: { hasMore: false, items: [pullRequest, newPullRequest], totalCount: 2 },
      type: "done",
    });
    stream.close();

    expect(await screen.findByText("Add incremental sync")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
    });
    expect((await readPullRequestsCache(repository))?.data.items).toHaveLength(2);
  });

  test("updates the saved list live and drops closed PRs once the sync completes", async () => {
    await writePullRequestsCache(repository, {
      data: {
        hasMore: false,
        items: [{ ...pullRequest, title: "Old title" }, closedPullRequest],
        totalCount: 2,
      },
      fetchedAt: Date.now(),
    });
    const stream = mockStreamingFetch();

    renderGridContainer();
    await userEvent.click(await screen.findByRole("button", { name: "Refresh PR list" }));

    expect((await screen.findByRole("status")).textContent).toBe("Synchronising…");

    stream.push({
      expectedCount: 2,
      overview: { hasMore: false, items: [pullRequest], totalCount: 2 },
      type: "progress",
    });

    expect(await screen.findByText("Launch the PR dashboard")).toBeTruthy();
    expect(screen.queryByText("Old title")).toBeNull();
    expect(screen.getByText("Remove the legacy flag")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("1 of 2 pull requests updated");
    expect((await readPullRequestsCache(repository))?.data.items[0]?.title).toBe("Old title");

    stream.push({
      overview: { hasMore: false, items: [pullRequest, newPullRequest], totalCount: 2 },
      type: "done",
    });
    stream.close();

    expect(await screen.findByText("Add incremental sync")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Remove the legacy flag")).toBeNull();
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      (await readPullRequestsCache(repository))?.data.items.map((item) => item.number),
    ).toEqual([21, 22]);
  });

  test("keeps the saved list when a refresh fails", async () => {
    await writePullRequestsCache(repository, {
      data: { hasMore: false, items: [pullRequest], totalCount: 1 },
      fetchedAt: Date.now(),
    });
    mockFetchResponse(502, {
      message: "The local gh CLI could not reach GitHub cleanly.",
      status: 502,
      type: "network",
    });

    renderGridContainer();
    await userEvent.click(await screen.findByRole("button", { name: "Refresh PR list" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Could not finish syncing the list.");
    expect(screen.getByText("Launch the PR dashboard")).toBeTruthy();
    expect((await readPullRequestsCache(repository))?.data.items).toHaveLength(1);
  });
});

function renderGridContainer() {
  return renderWithProviders(
    <PrGridContainer
      getReviewHref={(item) => `/openai/pr-status/pull/${item.number}/files`}
      repository={repository}
    />,
  );
}

function mockStreamingFetch() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(body, {
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        status: 200,
      }),
    ),
  );

  return {
    close: () => controller?.close(),
    push: (event: PullRequestsSyncEvent) =>
      controller?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
  };
}

function mockFetchResponse(status: number, payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    ),
  );
}

const repository = { owner: "openai", repo: "pr-status", repoInput: "openai/pr-status" };

const pullRequest: PullRequestCardModel = {
  id: "pr_21",
  number: 21,
  title: "Launch the PR dashboard",
  url: "https://github.com/openai/pr-status/pull/21",
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
};

const newPullRequest: PullRequestCardModel = {
  ...pullRequest,
  id: "pr_22",
  number: 22,
  title: "Add incremental sync",
  url: "https://github.com/openai/pr-status/pull/22",
};

const closedPullRequest: PullRequestCardModel = {
  ...pullRequest,
  id: "pr_9",
  number: 9,
  title: "Remove the legacy flag",
  url: "https://github.com/openai/pr-status/pull/9",
};
