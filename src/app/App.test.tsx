import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vite-plus/test";
import type {
  PullRequestReviewModel,
  PullRequestsOverview,
} from "../features/pull-requests/pull-request-model";
import {
  writePullRequestReviewCache,
  writePullRequestsCache,
} from "../features/pull-requests/pull-requests-cache";
import { SETTINGS_STORAGE_KEY, useSettingsStore } from "../features/settings/settings-store";
import { renderWithProviders } from "../test/render-with-providers";
import { App } from "./App";

const repository = { owner: "openai", repo: "pr-status" };

describe("App navigation", () => {
  test("opens a PR from the list and follows the browser history", async () => {
    await seedCaches();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/openai/pr-status/pulls");

    renderWithProviders(<App />);

    await userEvent.click(await screen.findByRole("link", { name: "Review" }));

    expect(window.location.pathname).toBe("/openai/pr-status/pull/18/files");
    expect(await screen.findByRole("heading", { name: "#18 Review a large PR" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "PR review" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Comments" }));

    expect(window.location.pathname).toBe("/openai/pr-status/pull/18");
    expect(screen.getByRole("button", { name: "Comments" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    window.history.back();

    await waitFor(() => {
      expect(window.location.pathname).toBe("/openai/pr-status/pull/18/files");
    });
    expect(screen.getByRole("button", { name: "PR review" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    window.history.back();

    expect(await screen.findByText("1 open pull requests")).toBeTruthy();
    expect(window.location.pathname).toBe("/openai/pr-status/pulls");

    window.history.forward();

    expect(await screen.findByRole("heading", { name: "#18 Review a large PR" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("goes back to the pull requests from the logo", async () => {
    await seedCaches();
    vi.stubGlobal("fetch", vi.fn());
    window.history.replaceState(null, "", "/openai/pr-status/pull/18/files");

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "#18 Review a large PR" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Kosmodiff" })).toBeTruthy();

    await userEvent.click(screen.getByRole("link", { name: "Kosmodiff" }));

    expect(window.location.pathname).toBe("/openai/pr-status/pulls");
    expect(await screen.findByText("1 open pull requests")).toBeTruthy();
    await waitFor(() => {
      expect(document.title).toBe("Pull requests · openai/pr-status · Kosmodiff");
    });
  });

  test("opens a pasted GitHub-like PR link and remembers its repository", async () => {
    await seedCaches();
    vi.stubGlobal("fetch", vi.fn());
    window.history.replaceState(null, "", "/openai/pr-status/pull/18");

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "#18 Review a large PR" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Comments" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await waitFor(() => {
      expect(useSettingsStore.getState().settings).toMatchObject(repository);
    });
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"repo":"pr-status"');
  });

  test("sends the home page to the saved repository", async () => {
    useSettingsStore.getState().saveSettings({ repoInput: "openai/pr-status" });
    vi.stubGlobal("fetch", vi.fn());

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/openai/pr-status/pulls");
    });
    expect(await screen.findByRole("button", { name: "Fetch PR list" })).toBeTruthy();
  });

  test("goes to the repository's PR list after the setup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            authenticated: true,
            cliAvailable: true,
            host: "github.com",
            login: "alexis",
            message: "Connected locally as @alexis through gh.",
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );

    renderWithProviders(<App />);

    await userEvent.type(screen.getByLabelText("Repository"), "openai/pr-status");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(window.location.pathname).toBe("/openai/pr-status/pulls");
    expect(await screen.findByText("No saved pull requests")).toBeTruthy();
  });
});

async function seedCaches() {
  await writePullRequestsCache(repository, { data: overview, fetchedAt: Date.now() });
  await writePullRequestReviewCache(repository, 18, { data: review, fetchedAt: Date.now() });
}

const pullRequest = {
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
  ciStatus: "success" as const,
  hasConflicts: false,
  unresolvedThreads: 0,
};

const overview: PullRequestsOverview = {
  hasMore: false,
  items: [pullRequest],
  totalCount: 1,
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
  pullRequest,
  threads: [],
  unresolvedThreads: 0,
};
