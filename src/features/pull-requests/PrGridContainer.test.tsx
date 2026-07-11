import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vite-plus/test";
import { useSettingsStore } from "../settings/settings-store";
import { PrGridContainer } from "./PrGridContainer";
import { writePullRequestsCache } from "./pull-requests-cache";
import { renderWithProviders } from "../../test/render-with-providers";

describe("PrGridContainer", () => {
  test("does not fetch pull requests until the list is refreshed", () => {
    seedSettings();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<PrGridContainer />);

    expect(screen.getByText("No saved pull requests")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh PR list" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("shows a local gh auth error state after refreshing", async () => {
    seedSettings();
    mockFetchResponse(401, {
      message:
        "Your local gh session is not authenticated. Run `gh auth login -h github.com` and retry.",
      status: 401,
      type: "auth",
    });

    renderWithProviders(<PrGridContainer />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh PR list" }));

    expect(await screen.findByText("GitHub CLI needs login")).toBeTruthy();
  });

  test("shows a repository access error state after refreshing", async () => {
    seedSettings();
    mockFetchResponse(404, {
      message: "This repository could not be found or is not accessible through gh.",
      status: 404,
      type: "repo",
    });

    renderWithProviders(<PrGridContainer />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh PR list" }));

    expect(await screen.findByText("Repository not accessible")).toBeTruthy();
  });

  test("shows an empty state when no open pull requests exist after refreshing", async () => {
    seedSettings();
    mockFetchResponse(200, {
      hasMore: false,
      items: [],
      totalCount: 0,
    });

    renderWithProviders(<PrGridContainer />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh PR list" }));

    expect(await screen.findByText("No open pull requests")).toBeTruthy();
  });

  test("renders the PR grid on success", async () => {
    seedSettings();
    mockFetchResponse(200, {
      hasMore: false,
      items: [
        {
          id: "pr_21",
          number: 21,
          title: "Launch the PR dashboard",
          url: "https://github.com/openai/pr-status/pull/21",
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

    renderWithProviders(<PrGridContainer />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh PR list" }));

    expect(await screen.findByText("Launch the PR dashboard")).toBeTruthy();
    expect(screen.getByText("1 open pull requests")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh PR list" })).toBeTruthy();
  });

  test("renders cached pull requests without refreshing in the background", () => {
    seedSettings();
    writePullRequestsCache({
      settings: { owner: "openai", repo: "pr-status", repoInput: "openai/pr-status" },
      dataUpdatedAt: new Date("2026-04-21T09:00:00.000Z").getTime(),
      data: {
        hasMore: false,
        items: [
          {
            id: "pr_cached",
            number: 34,
            title: "Use cached pull requests",
            url: "https://github.com/openai/pr-status/pull/34",
            authorLogin: "alexis",
            baseBranch: "main",
            headBranch: "cache-refresh",
            repositoryName: "openai/pr-status",
            updatedAt: "2026-04-21T09:00:00.000Z",
            isDraft: false,
            ciStatus: "success",
            hasConflicts: false,
            unresolvedThreads: 0,
          },
        ],
        totalCount: 1,
      },
    });
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<PrGridContainer />);

    expect(screen.getByText("Use cached pull requests")).toBeTruthy();
    expect(screen.getByText("cache-refresh")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function seedSettings() {
  useSettingsStore.getState().saveSettings({ repoInput: "openai/pr-status" });
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
