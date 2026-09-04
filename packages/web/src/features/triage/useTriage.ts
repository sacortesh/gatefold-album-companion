import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { api } from "../../api/client";

interface Config<T> {
  queryKey: QueryKey;
  /** Return a copy of `data` with the track's liked flag set to `liked`. */
  applyLike: (data: T, trackId: string, liked: boolean) => T;
  /** Return a copy of `data` with the track's inBanger flag set to `inBanger`
   * (adding also applies auto-Like; removing leaves Like untouched). */
  applyBanger: (data: T, trackId: string, inBanger: boolean) => T;
}

/** Like + Banger mutations that optimistically patch an arbitrary query's cache. */
export function useTriage<T>({ queryKey, applyLike, applyBanger }: Config<T>) {
  const qc = useQueryClient();

  const patch = (fn: (prev: T) => T) =>
    qc.setQueryData<T>(queryKey, (prev) => (prev ? fn(prev) : prev));

  // After a Like/Banger, refresh not just this view but every other surface that
  // shows liked/inBanger state — the now-playing card, the recent list, and any
  // album view's per-track states — so they never drift out of sync.
  const invalidateSoon = () =>
    window.setTimeout(() => {
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["recent"] });
      void qc.invalidateQueries({ queryKey: ["track-states"] });
    }, 700);

  const like = useMutation({
    mutationFn: ({ trackId, liked }: { trackId: string; liked: boolean }) =>
      liked ? api.unlike(trackId) : api.like(trackId),
    onMutate: ({ trackId, liked }) => {
      patch((d) => applyLike(d, trackId, !liked));
      return { trackId, liked };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) patch((d) => applyLike(d, ctx.trackId, ctx.liked));
    },
    onSettled: invalidateSoon,
  });

  const banger = useMutation({
    mutationFn: ({ trackId, inBanger }: { trackId: string; inBanger: boolean }) =>
      inBanger ? api.unbanger(trackId) : api.banger(trackId),
    onMutate: ({ trackId, inBanger }) => {
      patch((d) => applyBanger(d, trackId, !inBanger));
      return { trackId, inBanger };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) patch((d) => applyBanger(d, ctx.trackId, ctx.inBanger));
    },
    onSettled: invalidateSoon,
  });

  return {
    toggleLike: (trackId: string, liked: boolean) =>
      like.mutate({ trackId, liked }),
    fireBanger: (trackId: string, inBanger: boolean) =>
      banger.mutate({ trackId, inBanger }),
    pendingTrackId:
      (like.isPending && like.variables?.trackId) ||
      (banger.isPending && banger.variables?.trackId) ||
      null,
  };
}
