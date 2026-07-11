import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vite-plus/test";
import { renderWithProviders } from "../../test/render-with-providers";
import { useSettingsStore } from "../settings/settings-store";
import { PullRequestReviewContainer } from "./PullRequestReviewContainer";
import type { PullRequestReviewModel } from "./pull-request-model";
import { readPullRequestReviewCache, writePullRequestReviewCache } from "./pull-requests-cache";

describe("PullRequestReviewContainer", () => {
  test("does not fetch a PR review until the PR is refreshed", async () => {
    seedSettings();
    const fetchMock = mockFetchResponse(200, review);

    renderWithProviders(<PullRequestReviewContainer onBack={vi.fn()} pullRequestNumber={18} />);

    expect(screen.getByText("No saved review for PR #18")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to PRs" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Refresh PR" }));

    expect(await screen.findByRole("heading", { name: "#18 Review a large PR" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(readPullRequestReviewCache(repoSettings, 18)?.data.pullRequest.title).toBe(
        "Review a large PR",
      );
    });
  });

  test("renders a cached PR review without refreshing in the background", () => {
    seedSettings();
    writePullRequestReviewCache({
      data: review,
      dataUpdatedAt: new Date("2026-04-21T09:00:00.000Z").getTime(),
      number: 18,
      settings: repoSettings,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<PullRequestReviewContainer onBack={vi.fn()} pullRequestNumber={18} />);

    expect(screen.getByRole("heading", { name: "#18 Review a large PR" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function seedSettings() {
  useSettingsStore.getState().saveSettings({ repoInput: "openai/pr-status" });
}

function mockFetchResponse(status: number, payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

const repoSettings = {
  owner: "openai",
  repo: "pr-status",
  repoInput: "openai/pr-status",
};

const review: PullRequestReviewModel = {
  additions: 1,
  changedFiles: 0,
  commentsCount: 0,
  deletions: 0,
  files: [],
  pullRequest: {
    id: "pr-18",
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
    unresolvedThreads: 0,
  },
  threads: [],
  unresolvedThreads: 0,
};
