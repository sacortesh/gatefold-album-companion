import type { FastifyInstance } from "fastify";
import {
  playRequestSchema,
  seekRequestSchema,
  transferRequestSchema,
  type DevicesResponse,
  type PlaybackState,
} from "@spotify-companion/shared";
import { AppError } from "../errors.js";
import {
  getDevices,
  getPlayback,
  next,
  pause,
  play,
  previous,
  seek,
  transferPlayback,
  type PlayOptions,
} from "../spotify/player.js";
import { readConfig } from "../store/config.js";

const isNoDeviceError = (err: unknown): boolean =>
  err instanceof AppError &&
  err.statusCode === 404 &&
  /no active device/i.test(err.message);

/** Run a play, and if nothing is active, fall back to the preferred device. */
async function playWithFallback(opts: PlayOptions): Promise<void> {
  try {
    await play(opts);
  } catch (err) {
    if (!isNoDeviceError(err) || opts.deviceId) throw err;
    const { preferredDeviceId } = await readConfig("settings");
    if (!preferredDeviceId) {
      throw new AppError(
        "no_device",
        "No active Spotify device. Open Spotify somewhere, or pick a device in Settings.",
        409,
      );
    }
    await transferPlayback(preferredDeviceId, false);
    await play({ ...opts, deviceId: preferredDeviceId });
  }
}

export async function playbackRoutes(app: FastifyInstance): Promise<void> {
  app.get("/playback", async (): Promise<PlaybackState> => getPlayback());

  app.get("/devices", async (): Promise<DevicesResponse> => ({
    devices: await getDevices(),
  }));

  app.post("/playback/play", async (req) => {
    const opts = playRequestSchema.parse(req.body ?? {});
    await playWithFallback(opts);
    return { ok: true as const };
  });

  app.post("/playback/pause", async (req) => {
    const { deviceId } = playRequestSchema.parse(req.body ?? {});
    await pause(deviceId);
    return { ok: true as const };
  });

  app.post("/playback/next", async (req) => {
    const { deviceId } = playRequestSchema.parse(req.body ?? {});
    await next(deviceId);
    return { ok: true as const };
  });

  app.post("/playback/previous", async (req) => {
    const { deviceId } = playRequestSchema.parse(req.body ?? {});
    await previous(deviceId);
    return { ok: true as const };
  });

  app.post("/playback/seek", async (req) => {
    const { positionMs, deviceId } = seekRequestSchema.parse(req.body ?? {});
    await seek(positionMs, deviceId);
    return { ok: true as const };
  });

  app.post("/playback/transfer", async (req) => {
    const { deviceId, play: startPlaying } = transferRequestSchema.parse(
      req.body ?? {},
    );
    await transferPlayback(deviceId, startPlaying ?? false);
    return { ok: true as const };
  });
}
