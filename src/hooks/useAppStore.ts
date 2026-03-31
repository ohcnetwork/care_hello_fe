import { useQuery } from "@tanstack/react-query";
import type { AppStoreManifest } from "@/types/appStore";

const APP_STORE_URL =
  import.meta.env.VITE_APP_STORE_URL ?? "/app-store.json";

async function fetchAppStoreManifest(): Promise<AppStoreManifest> {
  const response = await fetch(APP_STORE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch app store manifest: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<AppStoreManifest>;
}

export function useAppStore() {
  return useQuery({
    queryKey: ["app-store"],
    queryFn: fetchAppStoreManifest,
    staleTime: 5 * 60 * 1000,
  });
}
