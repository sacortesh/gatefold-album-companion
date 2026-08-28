import { useQuery } from "@tanstack/react-query";
import type { TrackStatesResponse } from "@gatefold/shared";
import { api } from "../../api/client";
import { useTriage } from "../triage/useTriage";

const patchState = (
  data: TrackStatesResponse,
  trackId: string,
  change: Partial<{ liked: boolean; inBanger: boolean }>,
): TrackStatesResponse => ({
  ...data,
  states: {
    ...data.states,
    [trackId]: {
      liked: false,
      inBanger: false,
      ...data.states[trackId],
      ...change,
    },
  },
});

/** Track-level Like/Banger state + mutations for a fixed set of track ids. */
export function useAlbumTriage(albumId: string, trackIds: string[]) {
  const key = ["track-states", albumId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.trackStates(trackIds),
    enabled: trackIds.length > 0,
    staleTime: 10_000,
    // Pick up Likes made in the Spotify app (or on the now-playing card) while
    // this page is open.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const autoLike = query.data?.bangerAutoLike ?? true;

  const triage = useTriage<TrackStatesResponse>({
    queryKey: key,
    applyLike: (d, id, liked) => patchState(d, id, { liked }),
    applyBanger: (d, id) =>
      patchState(d, id, {
        inBanger: true,
        ...(autoLike ? { liked: true } : {}),
      }),
  });

  return {
    bangerLabel: query.data?.bangerLabel ?? "Banger",
    stateFor: (trackId: string) =>
      query.data?.states[trackId] ?? { liked: false, inBanger: false },
    ...triage,
  };
}
