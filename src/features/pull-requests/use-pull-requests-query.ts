import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { RepoSettings } from "../settings/repo-parser";
import { fetchPullRequests } from "./github-client";
import { readPullRequestsCache, writePullRequestsCache } from "./pull-requests-cache";

export function usePullRequestsQuery(settings: RepoSettings) {
  const cachedResult = useMemo(
    () => readPullRequestsCache(settings),
    [settings.owner, settings.repo],
  );
  const query = useQuery({
    queryKey: ["pull-requests", settings.owner, settings.repo],
    enabled: false,
    queryFn: () => fetchPullRequests(settings),
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

    writePullRequestsCache({
      data: query.data,
      dataUpdatedAt: query.dataUpdatedAt,
      settings,
    });
  }, [query.data, query.dataUpdatedAt, settings]);

  return query;
}
