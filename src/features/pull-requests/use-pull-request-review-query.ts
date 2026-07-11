import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { RepoSettings } from "../settings/repo-parser";
import { fetchPullRequestReview } from "./github-client";
import { readPullRequestReviewCache, writePullRequestReviewCache } from "./pull-requests-cache";

export function getPullRequestReviewQueryKey(settings: RepoSettings, number: number) {
  return ["pull-request-review", settings.owner, settings.repo, number] as const;
}

export function usePullRequestReviewQuery(settings: RepoSettings, number: number) {
  const cachedResult = useMemo(
    () => readPullRequestReviewCache(settings, number),
    [number, settings.owner, settings.repo],
  );
  const query = useQuery({
    queryKey: getPullRequestReviewQueryKey(settings, number),
    enabled: false,
    queryFn: () => fetchPullRequestReview(settings, number),
    initialData: cachedResult?.data,
    initialDataUpdatedAt: cachedResult?.dataUpdatedAt,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    writePullRequestReviewCache({
      data: query.data,
      dataUpdatedAt: query.dataUpdatedAt,
      number,
      settings,
    });
  }, [number, query.data, query.dataUpdatedAt, settings]);

  return query;
}
