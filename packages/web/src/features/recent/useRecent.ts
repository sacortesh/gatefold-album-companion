import { useQuery } from "@tanstack/react-query";
import type { RecentResponse } from "@spotify-companion/shared";
import { api, ApiRequestError } from "../../api/client";
import { useTriage } from "../triage/useTriage";

export const RECENT_KEY = ["recent"] as const;

const patchRow = (
  data: RecentResponse,
  trackId: string,
  change: Partial<{ liked: boolean; inBanger: boolean }>,
): RecentResponse => ({
  ...data,
  rows: data.rows.map((r) =>
    r.track.id === trackId ? { ...r, ...change } : r,
  ),
});

export function useRecent() {
  const query = useQuery<RecentResponse, ApiRequestError>({
    queryKey: RECENT_KEY,
    queryFn: api.recent,
    refetchInterval: 15_000,
    retry: (count, err) => err.status !== 401 && count < 2,
  });

  const autoLike = query.data?.bangerAutoLike ?? true;

  const triage = useTriage<RecentResponse>({
    queryKey: RECENT_KEY,
    applyLike: (d, id, liked) => patchRow(d, id, { liked }),
    applyBanger: (d, id) =>
      patchRow(d, id, { inBanger: true, ...(autoLike ? { liked: true } : {}) }),
  });

  return {
    query,
    notConnected: query.error?.status === 401,
    rows: query.data?.rows ?? [],
    bangerLabel: query.data?.bangerLabel ?? "Banger",
    bangerPlaylistId: query.data?.bangerPlaylistId ?? null,
    currentRow: query.data?.rows.find((r) => r.isCurrent) ?? null,
    ...triage,
  };
}
