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
  deepLinkUri,
}: {
  devices: Device[];
  loading: boolean;
  /** Omit to hide the "preferred device" radio column (the modal doesn't need it). */
  preferred?: string | null;
  onSetPreferred?: (deviceId: string) => void;
  onPlayHere: (deviceId: string) => void;
  playPending: boolean;
  /** The `spotify:...` URI of whatever the caller was trying to play, if
   *  known (only the no-device-found modal has this). A `spotify:` link
   *  hands off to the OS's registered protocol handler — the same trick
   *  Spotify's own embed widgets use — which launches the native app on
   *  this device (phone or desktop) instead of just telling the user to
   *  go find it themselves. Once that app is running it should register
   *  as a Connect device on its own; the 10s device-list poll picks it up
   *  without a manual refresh. */
  deepLinkUri?: string | null;
}) {
  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-sm text-ink-muted">Looking for devices…</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No Spotify devices found. Open Spotify on a phone, desktop, or
          speaker.
        </p>
      ) : (
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
      )}

      {/* Always shown when known, not just on the empty-list branch — the
       *  browsing device itself (e.g. a phone whose Spotify app isn't
       *  foregrounded) is never in the Connect device list even when other
       *  devices are, so this stays useful regardless of what's above. */}
      {!loading && deepLinkUri && (
        <div>
          <a
            href={deepLinkUri}
            className="inline-block text-sm text-primary hover:underline"
          >
            Play on this device →
          </a>
          <p className="mt-1 text-xs text-ink-muted">
            Opens the Spotify app installed here, if any — it should appear
            above within a few seconds.
          </p>
        </div>
      )}
    </div>
  );
}
