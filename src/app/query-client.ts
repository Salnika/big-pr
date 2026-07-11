import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

const defaultQueryOptions: DefaultOptions = {
  queries: {
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
};

export function createAppQueryClient(defaultOptions?: DefaultOptions) {
  return new QueryClient({
    defaultOptions: defaultOptions ?? defaultQueryOptions,
  });
}
