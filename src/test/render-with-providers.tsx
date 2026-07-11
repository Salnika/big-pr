import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createAppQueryClient } from "../app/query-client";

export function renderWithProviders(ui: ReactElement) {
  const queryClient = createAppQueryClient({
    queries: {
      gcTime: 0,
      retry: false,
      staleTime: 0,
      refetchInterval: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
