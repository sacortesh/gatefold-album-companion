import { DeviceList } from "./DeviceList";
import { useDevices } from "./useDevices";

export function DevicePicker() {
  const { devices, list, preferred, savePreferred, transfer } = useDevices();

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

      <DeviceList
        devices={list}
        loading={devices.isLoading}
        preferred={preferred}
        onSetPreferred={(id) => savePreferred.mutate(id)}
        onPlayHere={(id) => transfer.mutate(id)}
        playPending={transfer.isPending}
      />

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
