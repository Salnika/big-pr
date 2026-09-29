import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CachedResource } from "./pull-requests-cache";

export type SyncProgress = {
  completed: number;
  total: number;
};

type ReportProgress<T> = (partial: T, progress: SyncProgress) => void;

// Serves saved data first and only calls GitHub when the user asks for a refresh.
export function useCachedResource<T>({
  fetchFresh,
  mergePartial = (_saved, partial) => partial,
  onRefreshed,
  queryKey,
  readCached,
  writeCached,
}: {
  fetchFresh: (reportProgress: ReportProgress<T>) => Promise<T>;
  mergePartial?: (saved: T | undefined, partial: T) => T;
  onRefreshed?: (data: T) => Promise<unknown>;
  queryKey: QueryKey;
  readCached: () => Promise<CachedResource<T> | null>;
  writeCached: (entry: CachedResource<T>) => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const progressQueryKey = [...queryKey, "progress"];
  const cachedQuery = useQuery({
    networkMode: "always",
    queryFn: readCached,
    queryKey,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
  });
  // Filled while a refresh reports partial results; shared by every mounted view of the resource.
  const progressQuery = useQuery<SyncProgress | null>({
    enabled: false,
    queryFn: () => null,
    queryKey: progressQueryKey,
    staleTime: Infinity,
  });
  const refreshQuery = useQuery({
    enabled: false,
    queryFn: async () => {
      const saved = queryClient.getQueryData<CachedResource<T> | null>(queryKey) ?? null;

      try {
        const data = await fetchFresh((partial, progress) => {
          queryClient.setQueryData(progressQueryKey, progress);
          queryClient.setQueryData<CachedResource<T>>(queryKey, {
            data: mergePartial(saved?.data, partial),
            fetchedAt: saved?.fetchedAt ?? 0,
          });
        });
        const entry = { data, fetchedAt: Date.now() };

        queryClient.setQueryData(queryKey, entry);
        await writeCached(entry);
        await onRefreshed?.(entry.data);

        return entry.fetchedAt;
      } finally {
        queryClient.setQueryData(progressQueryKey, null);
      }
    },
    queryKey: [...queryKey, "refresh"],
  });

  return {
    data: cachedQuery.data?.data,
    error: refreshQuery.error,
    fetchedAt: cachedQuery.data?.fetchedAt ?? null,
    isLoadingCache: cachedQuery.isPending,
    isRefreshing: refreshQuery.isFetching,
    progress: refreshQuery.isFetching ? (progressQuery.data ?? null) : null,
    refresh: () => {
      void refreshQuery.refetch();
    },
    update: (updater: (data: T) => T) => {
      const entry = queryClient.setQueryData<CachedResource<T> | null>(queryKey, (current) =>
        current ? { ...current, data: updater(current.data) } : current,
      );

      if (entry) {
        void writeCached(entry);
      }

      return entry?.data ?? null;
    },
  };
}
