import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { PlaybackState } from "@gatefold/shared";
import { api, ApiRequestError } from "../../api/client";

export const PLAYBACK_KEY = ["playback"] as const;

/** Re-render every `ms` while `active`, so extrapolated progress stays smooth. */
function useTicker(ms: number, active: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms, active]);
}

export interface PlaybackView {
  query: ReturnType<typeof useQuery<PlaybackState, ApiRequestError>>;
  state: PlaybackState | undefined;
  /** Extrapolated playhead position in ms. */
  displayMs: number;
  notConnected: boolean;
  controls: {
    toggle: () => void;
    next: () => void;
    previous: () => void;
    seek: (positionMs: number) => void;
    pending: boolean;
    error: string | null;
    clearError: () => void;
  };
}

export function usePlayback(): PlaybackView {
  const qc = useQueryClient();

  const query = useQuery<PlaybackState, ApiRequestError>({
    queryKey: PLAYBACK_KEY,
    queryFn: api.playback,
    // Position between polls is extrapolated client-side (useTicker below),
    // so this only needs to be frequent enough to catch a track change.
    refetchInterval: 6000,
    retry: (count, err) => err.status !== 401 && count < 2,
  });

  const state = query.data;
  const notConnected =
    query.error instanceof ApiRequestError && query.error.status === 401;

  useTicker(500, Boolean(state?.isPlaying && state.track));

  const displayMs = (() => {
    if (!state?.track) return 0;
    const elapsed = state.isPlaying
      ? Date.now() - Date.parse(state.fetchedAt)
      : 0;
    return Math.min(state.track.durationMs, state.progressMs + elapsed);
  })();

  const [controlError, setControlError] = useState<string | null>(null);

  // Spotify's player state is eventually-consistent after a command — poke it
  // twice so the optimistic value doesn't visibly snap back.
  const refetchSoon = () => {
    for (const delay of [500, 1600]) {
      window.setTimeout(() => {
        void qc.invalidateQueries({ queryKey: PLAYBACK_KEY });
      }, delay);
    }
  };

  const patch = (fn: (prev: PlaybackState) => PlaybackState) =>
    qc.setQueryData<PlaybackState>(PLAYBACK_KEY, (prev) =>
      prev ? fn(prev) : prev,
    );

  const onError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Playback command failed";
    // "Restriction violated" during a toggle just means Spotify was already in
    // the target state — the next refetch reconciles it; no need to alarm.
    if (/restriction violated/i.test(msg)) return;
    setControlError(msg);
  };

  const toggle = useMutation({
    // `wasPlaying` is read from the cache at click time, before onMutate flips it.
    mutationFn: (wasPlaying: boolean) =>
      wasPlaying ? api.pause() : api.play(),
    onMutate: () => {
      setControlError(null);
      patch((p) => ({ ...p, isPlaying: !p.isPlaying }));
    },
    onError,
    onSettled: refetchSoon,
  });

  const skipNext = useMutation({
    mutationFn: () => api.next(),
    onMutate: () => setControlError(null),
    onError,
    onSettled: refetchSoon,
  });

  const skipPrev = useMutation({
    mutationFn: () => api.previous(),
    onMutate: () => setControlError(null),
    onError,
    onSettled: refetchSoon,
  });

  const doSeek = useMutation({
    mutationFn: (positionMs: number) => api.seek(positionMs),
    onMutate: (positionMs) => {
      setControlError(null);
      patch((p) => ({
        ...p,
        progressMs: positionMs,
        fetchedAt: new Date().toISOString(),
      }));
    },
    onError,
    onSettled: refetchSoon,
  });

  return {
    query,
    state,
    displayMs,
    notConnected,
    controls: {
      toggle: () =>
        toggle.mutate(
          Boolean(qc.getQueryData<PlaybackState>(PLAYBACK_KEY)?.isPlaying),
        ),
      next: () => skipNext.mutate(),
      previous: () => skipPrev.mutate(),
      seek: (positionMs) => doSeek.mutate(positionMs),
      pending:
        toggle.isPending ||
        skipNext.isPending ||
        skipPrev.isPending ||
        doSeek.isPending,
      error: controlError,
      clearError: () => setControlError(null),
    },
  };
}
