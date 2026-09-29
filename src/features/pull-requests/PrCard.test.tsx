import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { PrCard } from "./PrCard";

describe("PrCard", () => {
  test("renders draft, failing CI, conflicts, and 99+ unresolved comments", () => {
    render(
      <PrCard
        item={{
          id: "pr_1",
          number: 11,
          title: "Stabilize CI output",
          url: "https://github.com/openai/pr-status/pull/11",
          authorAvatarUrl: null,
          authorLogin: "octocat",
          baseBranch: "main",
          headBranch: "ci-output",
          repositoryName: "openai/pr-status",
          updatedAt: "2026-04-21T09:00:00.000Z",
          isDraft: true,
          ciStatus: "failure",
          hasConflicts: true,
          unresolvedThreads: 120,
        }}
      />,
    );

    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("CI failing")).toBeTruthy();
    expect(screen.getByText("Conflicts")).toBeTruthy();
    expect(screen.getByText("99+")).toBeTruthy();
    expect(screen.getByText("openai/pr-status")).toBeTruthy();
    expect(screen.getByText("ci-output")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
  });

  test("renders pending CI, no conflicts, and zero unresolved comments", () => {
    render(
      <PrCard
        item={{
          id: "pr_2",
          number: 12,
          title: "Refresh issue labels",
          url: "https://github.com/openai/pr-status/pull/12",
          authorAvatarUrl: null,
          authorLogin: "octocat",
          baseBranch: "release",
          headBranch: "labels-refresh",
          repositoryName: "openai/pr-status",
          updatedAt: "2026-04-21T09:00:00.000Z",
          isDraft: false,
          ciStatus: "pending",
          hasConflicts: false,
          unresolvedThreads: 0,
        }}
      />,
    );

    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("CI pending")).toBeTruthy();
    expect(screen.getByText("No conflicts")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });
});
