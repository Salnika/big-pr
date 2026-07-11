import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vite-plus/test";
import { PrGrid } from "./PrGrid";
import type { PullRequestCardModel } from "./pull-request-model";

describe("PrGrid", () => {
  test("switches to list mode and filters pull requests", async () => {
    renderGrid();

    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(screen.getByLabelText("CI failing"));

    expect(screen.getByText("Fix failing checks")).toBeTruthy();
    expect(screen.queryByText("Ready to merge")).toBeNull();
    expect(screen.getByText("1 of 3 displayed")).toBeTruthy();
  });

  test("sorts visible pull requests", async () => {
    renderGrid();

    await userEvent.click(screen.getByRole("button", { name: "List" }));
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "comments-desc");

    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(["Review comments", "Fix failing checks", "Ready to merge"]);
  });
});

function renderGrid() {
  return render(
    <PrGrid
      hasMore={false}
      isRefreshing={false}
      items={items}
      lastRefreshedAt="13:05"
      onRefresh={vi.fn()}
      totalCount={items.length}
    />,
  );
}

const items: PullRequestCardModel[] = [
  {
    id: "pr_1",
    number: 1,
    title: "Ready to merge",
    url: "https://github.com/openai/pr-status/pull/1",
    authorLogin: "alexis",
    baseBranch: "main",
    headBranch: "ready",
    repositoryName: "openai/pr-status",
    updatedAt: "2026-04-21T09:00:00.000Z",
    isDraft: false,
    ciStatus: "success",
    hasConflicts: false,
    unresolvedThreads: 0,
  },
  {
    id: "pr_2",
    number: 2,
    title: "Fix failing checks",
    url: "https://github.com/openai/pr-status/pull/2",
    authorLogin: "mira",
    baseBranch: "main",
    headBranch: "ci-fix",
    repositoryName: "openai/pr-status",
    updatedAt: "2026-04-21T10:00:00.000Z",
    isDraft: false,
    ciStatus: "failure",
    hasConflicts: false,
    unresolvedThreads: 2,
  },
  {
    id: "pr_3",
    number: 3,
    title: "Review comments",
    url: "https://github.com/openai/pr-status/pull/3",
    authorLogin: "octocat",
    baseBranch: "release",
    headBranch: "comments",
    repositoryName: "openai/pr-status",
    updatedAt: "2026-04-21T08:00:00.000Z",
    isDraft: true,
    ciStatus: "pending",
    hasConflicts: true,
    unresolvedThreads: 8,
  },
];
