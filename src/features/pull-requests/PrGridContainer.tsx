import { useState } from "react";
import { formatRefreshTime } from "../../shared/lib/date";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { useSettingsStore } from "../settings/settings-store";
import { getGithubErrorMessage, getGithubErrorTitle } from "./github-error-copy";
import { PrGrid } from "./PrGrid";
import { PullRequestReviewContainer } from "./PullRequestReviewContainer";
import { usePullRequestsQuery } from "./use-pull-requests-query";

export function PrGridContainer() {
  const settings = useSettingsStore((store) => store.settings);
  const [selectedPullRequestNumber, setSelectedPullRequestNumber] = useState<number | null>(null);
  const query = usePullRequestsQuery(settings);

  if (selectedPullRequestNumber) {
    return (
      <PullRequestReviewContainer
        onBack={() => setSelectedPullRequestNumber(null)}
        pullRequestNumber={selectedPullRequestNumber}
      />
    );
  }

  if (!query.data && query.isFetching) {
    return (
      <EmptyState
        title="Loading pull requests"
        description="Checking GitHub for the latest pull request status."
      />
    );
  }

  if (query.isError && !query.data) {
    return (
      <ErrorState
        description={getGithubErrorMessage(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
        title={getGithubErrorTitle(query.error)}
      />
    );
  }

  if (!query.data) {
    return (
      <EmptyState
        title="No saved pull requests"
        description="Refresh the PR list to fetch this repository's pull requests, then they will stay available from local storage."
        action={
          <Button
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
            variant="primary"
          >
            Refresh PR list
          </Button>
        }
      />
    );
  }

  if (!query.data.items.length) {
    return (
      <EmptyState
        title="No open pull requests"
        description="This repository currently has no open pull requests to review."
        action={
          <Button
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
            variant="primary"
          >
            Refresh PR list
          </Button>
        }
      />
    );
  }

  return (
    <PrGrid
      hasMore={query.data.hasMore}
      isRefreshing={query.isFetching}
      items={query.data.items}
      lastRefreshedAt={formatRefreshTime(query.dataUpdatedAt)}
      onRefresh={() => {
        void query.refetch();
      }}
      onSelectPullRequest={(item) => setSelectedPullRequestNumber(item.number)}
      totalCount={query.data.totalCount}
    />
  );
}
