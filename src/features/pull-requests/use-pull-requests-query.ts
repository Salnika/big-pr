import type { QueryClient } from "@tanstack/react-query";
import type { RepoSettings } from "../settings/repo-parser";
import { fetchPullRequests } from "./github-client";
import type { PullRequestCardModel, PullRequestsOverview } from "./pull-request-model";
import {
  type CachedResource,
  readPullRequestsCache,
  writePullRequestsCache,
} from "./pull-requests-cache";
import { mergeFreshPullRequests, setOverviewPullRequest } from "./review-updates";
import { useCachedResource } from "./use-cached-resource";

export function getPullRequestsQueryKey(repository: Pick<RepoSettings, "owner" | "repo">) {
  return ["pull-requests", repository.owner, repository.repo] as const;
}

export function usePullRequestsQuery(repository: RepoSettings) {
  return useCachedResource({
    fetchFresh: (reportProgress) =>
      fetchPullRequests(repository, {
        onProgress: ({ expectedCount, overview }) =>
          reportProgress(overview, {
            completed: overview.items.length,
            total: expectedCount,
          }),
      }),
    mergePartial: mergeFreshPullRequests,
    queryKey: getPullRequestsQueryKey(repository),
    readCached: () => readPullRequestsCache(repository),
    writeCached: (entry) => writePullRequestsCache(repository, entry),
  });
}

// Keeps a PR's row in the saved list in sync with its freshly fetched or edited review.
export async function syncPullRequestInOverview(
  queryClient: QueryClient,
  repository: Pick<RepoSettings, "owner" | "repo">,
  pullRequest: PullRequestCardModel,
) {
  const queryKey = getPullRequestsQueryKey(repository);
  const current =
    queryClient.getQueryData<CachedResource<PullRequestsOverview> | null>(queryKey) ??
    (await readPullRequestsCache(repository));

  if (!current?.data.items.some((item) => item.number === pullRequest.number)) {
    return;
  }

  const entry = {
    ...current,
    data: setOverviewPullRequest(current.data, pullRequest),
  };

  queryClient.setQueryData(queryKey, entry);
  await writePullRequestsCache(repository, entry);
}
