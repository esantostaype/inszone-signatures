import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SavedSignature } from "@/components/signatures/SignaturesTable";

export const SIGNATURES_KEY = ["signatures"] as const;

async function fetchSignatures(): Promise<SavedSignature[]> {
  const res = await fetch("/api/signatures");
  if (!res.ok) throw new Error("Failed to fetch signatures");
  const json = await res.json();
  return json.data ?? [];
}

export function useSignatures() {
  return useQuery({
    queryKey: SIGNATURES_KEY,
    queryFn:  fetchSignatures,
  });
}

export function useInvalidateSignatures() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SIGNATURES_KEY });
}