"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 60_000,          // 1 min — don't refetch on every navigation
        refetchOnWindowFocus: false, // don't refetch every time the tab is focused
        refetchOnMount: false,       // use cached data when navigating back to a page
      },
    },
  }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
