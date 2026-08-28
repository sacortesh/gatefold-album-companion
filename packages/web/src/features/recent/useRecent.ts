import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecentResponse } from "@spotify-companion/shared";
import { api, ApiRequestError } from "../../api/client";

export const RECENT_KEY = ["recent"] as const;

export function useRecent() {
  const qc = useQueryClient();

  const query = useQuery<RecentResponse, ApiRequestError>({
    queryKey: RECENT_KEY,
    queryFn: api.recent,
    refetchInterval: 15_000,
    retry: (count, err) => err.status !== 401 && count < 2,
  });

  const notConnected = query.error?.status === 401;

  const patchRow = (
    trackId: string,
    change: Partial<{ liked: boolean; inBanger: boolean }>,
  ) =>
    qc.setQueryData<RecentResponse>(RECENT_KEY, (prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r) =>
              r.track.id === trackId ? { ...r, ...change } : r,
            ),
          }
        : prev,
    );

  const invalidateSoon = () =>
    window.setTimeout(
      () => void qc.invalidateQueries({ queryKey: RECENT_KEY }),
      700,
    );

  const like = useMutation({
    mutationFn: ({ trackId, liked }: { trackId: string; liked: boolean }) =>
      liked ? api.unlike(trackId) : api.like(trackId),
    onMutate: ({ trackId, liked }) => {
      patchRow(trackId, { liked: !liked });
      return { trackId, liked };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) patchRow(ctx.trackId, { liked: ctx.liked });
    },
    onSettled: invalidateSoon,
  });

  const autoLike = query.data?.bangerAutoLike ?? true;

  const banger = useMutation({
    mutationFn: (trackId: string) => api.banger(trackId),
    onMutate: (trackId) => {
      const prevRow = qc
        .getQueryData<RecentResponse>(RECENT_KEY)
        ?.rows.find((r) => r.track.id === trackId);
      patchRow(trackId, {
        inBanger: true,
        ...(autoLike ? { liked: true } : {}),
      });
      return { trackId, prev: prevRow };
    },
    onError: (_e, trackId, ctx) => {
      if (ctx?.prev) {
        patchRow(trackId, {
          inBanger: ctx.prev.inBanger,
          liked: ctx.prev.liked,
        });
      }
    },
    onSettled: invalidateSoon,
  });

  return {
    query,
    notConnected,
    rows: query.data?.rows ?? [],
    bangerLabel: query.data?.bangerLabel ?? "Banger",
    bangerPlaylistId: query.data?.bangerPlaylistId ?? null,
    currentRow: query.data?.rows.find((r) => r.isCurrent) ?? null,
    toggleLike: (trackId: string, liked: boolean) =>
      like.mutate({ trackId, liked }),
    fireBanger: (trackId: string) => banger.mutate(trackId),
    pendingTrackId:
      (like.isPending && like.variables?.trackId) ||
      (banger.isPending && banger.variables) ||
      null,
  };
}
