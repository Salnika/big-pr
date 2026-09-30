import { appName } from "../../shared/lib/app-name";
import { useDocumentTitle } from "../../shared/lib/navigation";
import { formatRefreshTime } from "../../shared/lib/date";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { formatRepoLabel, type RepoSettings } from "../settings/repo-parser";
import { getGithubErrorMessage, getGithubErrorTitle } from "./github-error-copy";
import { PrGrid } from "./PrGrid";
import type { PullRequestCardModel } from "./pull-request-model";
import { usePullRequestsQuery } from "./use-pull-requests-query";

type PrGridContainerProps = {
  getReviewHref: (item: PullRequestCardModel) => string;
  repository: RepoSettings;
};

export function PrGridContainer({ getReviewHref, repository }: PrGridContainerProps) {
  const pullRequests = usePullRequestsQuery(repository);

  useDocumentTitle(`Pull requests · ${formatRepoLabel(repository)} · ${appName}`);

  if (pullRequests.isLoadingCache) {
    return null;
  }

  if (!pullRequests.data && pullRequests.isRefreshing) {
    return (
      <EmptyState
        title="Loading pull requests"
        description="Checking GitHub for the latest pull request status."
      />
    );
  }

  if (pullRequests.error && !pullRequests.data) {
    return (
      <ErrorState
        description={getGithubErrorMessage(pullRequests.error)}
        onRetry={pullRequests.refresh}
        title={getGithubErrorTitle(pullRequests.error)}
      />
    );
  }

  if (!pullRequests.data) {
    return (
      <EmptyState
        title="No saved pull requests"
        description="Fetch this repository's pull requests, then they will stay available from local storage."
        action={
          <Button
            disabled={pullRequests.isRefreshing}
            onClick={pullRequests.refresh}
            variant="primary"
          >
            Fetch PR list
          </Button>
        }
      />
    );
  }

  if (!pullRequests.data.items.length) {
    return (
      <EmptyState
        title="No open pull requests"
        description="This repository currently has no open pull requests to review."
        action={
          <Button
            disabled={pullRequests.isRefreshing}
            onClick={pullRequests.refresh}
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
      getReviewHref={getReviewHref}
      hasMore={pullRequests.data.hasMore}
      isRefreshing={pullRequests.isRefreshing}
      items={pullRequests.data.items}
      lastRefreshedAt={pullRequests.fetchedAt ? formatRefreshTime(pullRequests.fetchedAt) : null}
      onRefresh={pullRequests.refresh}
      refreshError={pullRequests.error}
      syncProgress={pullRequests.progress}
      totalCount={pullRequests.data.totalCount}
    />
  );
}
