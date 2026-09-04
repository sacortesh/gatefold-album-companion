import type { Device } from "@gatefold/shared";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

/** The device rows shared by the Settings page's `DevicePicker` section and
 *  the no-device-found modal (Phase 10.8) — one list, two call sites. */
export function DeviceList({
  devices,
  loading,
  preferred,
  onSetPreferred,
  onPlayHere,
  playPending,
}: {
  devices: Device[];
  loading: boolean;
  /** Omit to hide the "preferred device" radio column (the modal doesn't need it). */
  preferred?: string | null;
  onSetPreferred?: (deviceId: string) => void;
  onPlayHere: (deviceId: string) => void;
  playPending: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-ink-muted">Looking for devices…</p>;
  }
  if (devices.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No Spotify devices found. Open Spotify on a phone, desktop, or
        speaker.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {devices.map((d) => (
        <li
          key={d.id}
          className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface"
        >
          <div className="flex items-center gap-2 text-sm">
            {onSetPreferred && (
              <input
                type="radio"
                name="preferred-device"
                checked={preferred === d.id}
                onChange={() => onSetPreferred(d.id)}
                className="accent-primary"
              />
            )}
            <span>{d.name}</span>
            <span className="text-xs text-ink-muted">{d.type}</span>
            {d.isActive && <Badge variant="now-playing">active</Badge>}
          </div>
          {!d.isActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPlayHere(d.id)}
              disabled={playPending}
            >
              Play here
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
