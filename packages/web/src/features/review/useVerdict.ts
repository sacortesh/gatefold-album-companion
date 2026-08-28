import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Review, VerdictRequest } from "@gatefold/shared";
import { api, ApiRequestError } from "../../api/client";
import { BACKLOG_KEY } from "../backlog/useBacklog";

/** The album's existing review, or null when there isn't one (404). */
export function useAlbumReview(albumId: string) {
  return useQuery<Review | null, ApiRequestError>({
    queryKey: ["review", albumId],
    queryFn: async () => {
      try {
        return await api.review(albumId);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: Boolean(albumId),
  });
}

export function useSubmitVerdict(albumId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VerdictRequest) => api.verdict(body),
    onSuccess: () => {
      for (const key of [
        BACKLOG_KEY,
        ["reviews"],
        ["revisit"],
        ["review", albumId],
        ["album", albumId],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
