import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PLAYBACK_KEY } from "../now-playing/usePlayback";

export function DevicePicker() {
  const qc = useQueryClient();

  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: api.devices,
    refetchInterval: 10_000,
  });

  const settings = useQuery({
    queryKey: ["config", "settings"],
    queryFn: () => api.getConfig("settings"),
  });

  const savePreferred = useMutation({
    mutationFn: (deviceId: string | null) =>
      api.putConfig("settings", {
        ...(settings.data ?? { preferredDeviceId: null }),
        preferredDeviceId: deviceId,
      }),
    onSuccess: (next) => qc.setQueryData(["config", "settings"], next),
  });

  const transfer = useMutation({
    mutationFn: (deviceId: string) => api.transfer(deviceId, true),
    onSettled: () =>
      window.setTimeout(
        () => void qc.invalidateQueries({ queryKey: PLAYBACK_KEY }),
        600,
      ),
  });

  const preferred = settings.data?.preferredDeviceId ?? null;
  const list = devices.data?.devices ?? [];

  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-300">Playback device</h2>
        <button
          type="button"
          onClick={() => devices.refetch()}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Refresh
        </button>
      </div>

      <p className="text-xs text-neutral-500">
        The preferred device is used when nothing is already playing.
      </p>

      {devices.isLoading && (
        <p className="text-sm text-neutral-500">Looking for devices…</p>
      )}

      {devices.isSuccess && list.length === 0 && (
        <p className="text-sm text-neutral-500">
          No Spotify devices found. Open Spotify on a phone, desktop, or speaker.
        </p>
      )}

      <ul className="space-y-1">
        {list.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-neutral-900"
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="preferred-device"
                checked={preferred === d.id}
                onChange={() => savePreferred.mutate(d.id)}
              />
              <span>{d.name}</span>
              <span className="text-xs text-neutral-500">{d.type}</span>
              {d.isActive && (
                <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  active
                </span>
              )}
            </label>
            {!d.isActive && (
              <button
                type="button"
                onClick={() => transfer.mutate(d.id)}
                disabled={transfer.isPending}
                className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
              >
                Play here
              </button>
            )}
          </li>
        ))}
      </ul>

      {preferred && (
        <button
          type="button"
          onClick={() => savePreferred.mutate(null)}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Clear preferred device
        </button>
      )}
    </div>
  );
}
