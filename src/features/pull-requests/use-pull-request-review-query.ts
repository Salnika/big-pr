import { useQueryClient } from "@tanstack/react-query";
import type { RepoSettings } from "../settings/repo-parser";
import { fetchPullRequestReview } from "./github-client";
import type { PullRequestReviewModel } from "./pull-request-model";
import {
  pruneCachedRepositoryFiles,
  readPullRequestReviewCache,
  writePullRequestReviewCache,
} from "./pull-requests-cache";
import { useCachedResource } from "./use-cached-resource";
import { syncPullRequestInOverview } from "./use-pull-requests-query";

type Repository = Pick<RepoSettings, "owner" | "repo">;

export function getPullRequestReviewQueryKey(repository: Repository, number: number) {
  return ["pull-request-review", repository.owner, repository.repo, number] as const;
}

export function getRepositoryFilesQueryKey(repository: Repository, number: number) {
  return ["repository-file", repository.owner, repository.repo, number] as const;
}

export function usePullRequestReviewQuery(repository: RepoSettings, number: number) {
  const queryClient = useQueryClient();

  return useCachedResource({
    fetchFresh: () => fetchPullRequestReview(repository, number),
    onRefreshed: async (review) => {
      const keptRefs = getReviewCommitOids(review);

      queryClient.removeQueries({
        predicate: (query) => !keptRefs.has(String(query.queryKey[4])),
        queryKey: getRepositoryFilesQueryKey(repository, number),
      });
      await Promise.all([
        pruneCachedRepositoryFiles(repository, number, keptRefs),
        syncPullRequestInOverview(queryClient, repository, review.pullRequest),
      ]);
    },
    queryKey: getPullRequestReviewQueryKey(repository, number),
    readCached: () => readPullRequestReviewCache(repository, number),
    writeCached: (entry) => writePullRequestReviewCache(repository, number, entry),
  });
}

// Files are cached per commit, so only the commits the refreshed review still points at stay useful.
function getReviewCommitOids(review: PullRequestReviewModel) {
  return new Set(
    [review.headRefOid, ...review.threads.map((thread) => thread.originalCommitOid)].filter(
      (oid): oid is string => Boolean(oid),
    ),
  );
}
