import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
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
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink">Playback device</h2>
        <button
          type="button"
          onClick={() => devices.refetch()}
          className="text-xs text-ink-muted hover:text-ink"
        >
          Refresh
        </button>
      </div>

      <p className="text-xs text-ink-muted">
        The preferred device is used when nothing is already playing.
      </p>

      {devices.isLoading && (
        <p className="text-sm text-ink-muted">Looking for devices…</p>
      )}

      {devices.isSuccess && list.length === 0 && (
        <p className="text-sm text-ink-muted">
          No Spotify devices found. Open Spotify on a phone, desktop, or speaker.
        </p>
      )}

      <ul className="space-y-1">
        {list.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface"
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="preferred-device"
                checked={preferred === d.id}
                onChange={() => savePreferred.mutate(d.id)}
                className="accent-primary"
              />
              <span>{d.name}</span>
              <span className="text-xs text-ink-muted">{d.type}</span>
              {d.isActive && <Badge variant="now-playing">active</Badge>}
            </label>
            {!d.isActive && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => transfer.mutate(d.id)}
                disabled={transfer.isPending}
              >
                Play here
              </Button>
            )}
          </li>
        ))}
      </ul>

      {preferred && (
        <button
          type="button"
          onClick={() => savePreferred.mutate(null)}
          className="text-xs text-ink-muted hover:text-ink"
        >
          Clear preferred device
        </button>
      )}
    </div>
  );
}
