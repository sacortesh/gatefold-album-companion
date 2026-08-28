import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BacklogResponse } from "@spotify-companion/shared";
import { api, ApiRequestError } from "../../api/client";

export const BACKLOG_KEY = ["backlog"] as const;

export function useBacklog() {
  const qc = useQueryClient();

  const query = useQuery<BacklogResponse, ApiRequestError>({
    queryKey: BACKLOG_KEY,
    queryFn: api.backlog,
    retry: (count, err) => err.status !== 401 && count < 2,
  });

  const items = query.data?.items ?? [];
  const setData = (fn: (prev: BacklogResponse) => BacklogResponse) =>
    qc.setQueryData<BacklogResponse>(BACKLOG_KEY, (prev) =>
      prev ? fn(prev) : prev,
    );
  const invalidate = () => qc.invalidateQueries({ queryKey: BACKLOG_KEY });

  const add = useMutation({
    mutationFn: (album: string) => api.addToBacklog(album),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (albumId: string) => api.removeFromBacklog(albumId),
    onMutate: async (albumId) => {
      await qc.cancelQueries({ queryKey: BACKLOG_KEY });
      const prev = qc.getQueryData<BacklogResponse>(BACKLOG_KEY);
      setData((p) => ({ items: p.items.filter((i) => i.albumId !== albumId) }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(BACKLOG_KEY, ctx.prev);
    },
    onSettled: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (albumIds: string[]) => api.reorderBacklog(albumIds),
    onMutate: async (albumIds) => {
      await qc.cancelQueries({ queryKey: BACKLOG_KEY });
      const prev = qc.getQueryData<BacklogResponse>(BACKLOG_KEY);
      setData((p) => {
        const byId = new Map(p.items.map((i) => [i.albumId, i]));
        return { items: albumIds.flatMap((id) => byId.get(id) ?? []) };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(BACKLOG_KEY, ctx.prev);
    },
    onSettled: invalidate,
  });

  const playAlbum = useMutation({
    mutationFn: (contextUri: string) => api.play({ contextUri }),
  });

  const move = (albumId: string, dir: -1 | 1) => {
    const ids = items.map((i) => i.albumId);
    const from = ids.indexOf(albumId);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    reorder.mutate(ids);
  };

  return {
    query,
    notConnected: query.error?.status === 401,
    items,
    add,
    remove,
    reorder,
    playAlbum,
    move,
  };
}
