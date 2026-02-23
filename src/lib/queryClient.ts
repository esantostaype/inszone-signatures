import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // nunca se considera stale automáticamente
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});