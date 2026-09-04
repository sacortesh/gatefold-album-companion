import { createContext, useContext, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { DeviceList } from "../settings/DeviceList";
import { useDevices } from "../settings/useDevices";

interface DevicePickerPromptContextValue {
  /** Open the "choose a device" modal; `retry` re-runs the play call that
   *  hit `no_device` once a device is picked and playback is transferred. */
  requestDevice: (retry: () => void) => void;
}

const DevicePickerPromptContext =
  createContext<DevicePickerPromptContextValue | null>(null);

export function useDevicePickerPrompt(): DevicePickerPromptContextValue {
  const ctx = useContext(DevicePickerPromptContext);
  if (!ctx) {
    throw new Error(
      "useDevicePickerPrompt must be used within DevicePickerPromptProvider",
    );
  }
  return ctx;
}

/** Mounted once in `Layout`. Any play mutation across the app can call
 *  `requestDevice()` on a `no_device` 409 instead of dead-ending on red text
 *  (Phase 10.8) — the modal transfers playback to the chosen device, then
 *  retries the original play call. */
export function DevicePickerPromptProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const { devices, list, transfer } = useDevices();

  const requestDevice = (retryFn: () => void) => setRetry(() => retryFn);

  const handlePick = async (deviceId: string) => {
    await transfer.mutateAsync(deviceId);
    const fn = retry;
    setRetry(null);
    // Mirrors the Settings page's own transfer → playback-state settle delay
    // (`useDevices`'s `onSettled`) — give Spotify a beat to register the
    // transfer before retrying the play call on it.
    window.setTimeout(() => fn?.(), 600);
  };

  return (
    <DevicePickerPromptContext.Provider value={{ requestDevice }}>
      {children}
      <Dialog
        open={retry !== null}
        onOpenChange={(open) => !open && setRetry(null)}
      >
        <DialogContent>
          <DialogTitle>Choose a device to play on</DialogTitle>
          <p className="mt-1 text-sm text-ink-muted">
            Nothing is playing anywhere right now. Pick a device and playback
            will start there.
          </p>
          <div className="mt-4">
            <DeviceList
              devices={list}
              loading={devices.isLoading}
              onPlayHere={(id) => void handlePick(id)}
              playPending={transfer.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </DevicePickerPromptContext.Provider>
  );
}
