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
  /** Return a copy of `data` reflecting the track being added to the Banger playlist (+ auto-Like). */
  applyBanger: (data: T, trackId: string) => T;
}

/** Like + Banger mutations that optimistically patch an arbitrary query's cache. */
export function useTriage<T>({ queryKey, applyLike, applyBanger }: Config<T>) {
  const qc = useQueryClient();

  const patch = (fn: (prev: T) => T) =>
    qc.setQueryData<T>(queryKey, (prev) => (prev ? fn(prev) : prev));

  const invalidateSoon = () =>
    window.setTimeout(() => void qc.invalidateQueries({ queryKey }), 700);

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
    mutationFn: (trackId: string) => api.banger(trackId),
    onMutate: (trackId) => patch((d) => applyBanger(d, trackId)),
    onSettled: invalidateSoon,
  });

  return {
    toggleLike: (trackId: string, liked: boolean) =>
      like.mutate({ trackId, liked }),
    fireBanger: (trackId: string) => banger.mutate(trackId),
    pendingTrackId:
      (like.isPending && like.variables?.trackId) ||
      (banger.isPending && banger.variables) ||
      null,
  };
}
