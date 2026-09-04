import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { api } from "../../api/client";
import { RECENT_KEY } from "../recent/useRecent";

export function BangerPlaylistPicker() {
  const qc = useQueryClient();

  const playlists = useQuery({
    queryKey: ["playlists"],
    queryFn: api.playlists,
    staleTime: 60_000,
  });

  const buttons = useQuery({
    queryKey: ["config", "buttons"],
    queryFn: () => api.getConfig("buttons"),
  });

  const save = useMutation({
    mutationFn: (playlistId: string) => {
      const current = buttons.data;
      if (!current) throw new Error("config not loaded");
      return api.putConfig("buttons", {
        ...current,
        banger: { ...current.banger, playlistId },
      });
    },
    onSuccess: (next) => {
      qc.setQueryData(["config", "buttons"], next);
      void qc.invalidateQueries({ queryKey: RECENT_KEY });
    },
  });

  const selected = buttons.data?.banger.playlistId ?? "";
  const list = playlists.data?.playlists ?? [];

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-ink">Banger playlist</h2>
      <p className="text-xs text-ink-muted">
        The <span className="text-banger">Banger</span> button adds the track
        here
        {buttons.data?.banger.autoLike ? " and to Liked Songs" : ""}.
      </p>

      {playlists.isLoading && (
        <p className="text-sm text-ink-muted">Loading your playlists…</p>
      )}
      {playlists.isError && (
        <p className="text-sm text-danger">
          Couldn&apos;t load playlists: {(playlists.error as Error).message}
        </p>
      )}

      {playlists.isSuccess && (
        <select
          value={list.some((p) => p.id === selected) ? selected : ""}
          onChange={(e) => e.target.value && save.mutate(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink"
        >
          <option value="" disabled>
            {selected ? "(current selection not in your editable playlists)" : "Choose a playlist…"}
          </option>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.trackCount} tracks
            </option>
          ))}
        </select>
      )}

      {save.isError && (
        <p className="text-sm text-danger">
          Couldn&apos;t save: {(save.error as Error).message}
        </p>
      )}
      {selected && (
        <a
          href={`https://open.spotify.com/playlist/${selected}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          Open current playlist in Spotify <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
