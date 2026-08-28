import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    <div className="space-y-3 rounded-lg border border-neutral-800 p-4">
      <h2 className="text-sm font-medium text-neutral-300">Banger playlist</h2>
      <p className="text-xs text-neutral-500">
        The <span className="text-amber-400">Banger</span> button adds the track
        here
        {buttons.data?.banger.autoLike ? " and to Liked Songs" : ""}.
      </p>

      {playlists.isLoading && (
        <p className="text-sm text-neutral-500">Loading your playlists…</p>
      )}
      {playlists.isError && (
        <p className="text-sm text-red-400">
          Couldn&apos;t load playlists: {(playlists.error as Error).message}
        </p>
      )}

      {playlists.isSuccess && (
        <select
          value={list.some((p) => p.id === selected) ? selected : ""}
          onChange={(e) => e.target.value && save.mutate(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
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
        <p className="text-sm text-red-400">
          Couldn&apos;t save: {(save.error as Error).message}
        </p>
      )}
      {selected && (
        <a
          href={`https://open.spotify.com/playlist/${selected}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Open current playlist in Spotify ↗
        </a>
      )}
    </div>
  );
}
