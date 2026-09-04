import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PLAYBACK_KEY } from "../now-playing/usePlayback";

/** Shared devices/preferred-device data, used by the Settings page section
 *  and the no-device-found modal (Phase 10.8) so both read the same cache. */
export function useDevices() {
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

  return {
    devices,
    settings,
    preferred: settings.data?.preferredDeviceId ?? null,
    list: devices.data?.devices ?? [],
    savePreferred,
    transfer,
  };
}
