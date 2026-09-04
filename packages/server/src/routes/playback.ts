import type { FastifyInstance } from "fastify";
import {
  deviceIdRequestSchema,
  devicesResponseSchema,
  okSchema,
  playRequestSchema,
  playbackStateSchema,
  seekRequestSchema,
  transferRequestSchema,
  type DevicesResponse,
  type PlaybackState,
} from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
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
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/playback",
    { schema: { response: { 200: playbackStateSchema } } },
    async (): Promise<PlaybackState> => getPlayback(),
  );

  typed.get(
    "/devices",
    { schema: { response: { 200: devicesResponseSchema } } },
    async (): Promise<DevicesResponse> => ({ devices: await getDevices() }),
  );

  typed.post(
    "/playback/play",
    { schema: { body: playRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      await playWithFallback(req.body);
      return { ok: true as const };
    },
  );

  typed.post(
    "/playback/pause",
    { schema: { body: deviceIdRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      await pause(req.body.deviceId);
      return { ok: true as const };
    },
  );

  typed.post(
    "/playback/next",
    { schema: { body: deviceIdRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      await next(req.body.deviceId);
      return { ok: true as const };
    },
  );

  typed.post(
    "/playback/previous",
    { schema: { body: deviceIdRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      await previous(req.body.deviceId);
      return { ok: true as const };
    },
  );

  typed.post(
    "/playback/seek",
    { schema: { body: seekRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      await seek(req.body.positionMs, req.body.deviceId);
      return { ok: true as const };
    },
  );

  typed.post(
    "/playback/transfer",
    { schema: { body: transferRequestSchema, response: { 200: okSchema } } },
    async (req) => {
      await transferPlayback(req.body.deviceId, req.body.play ?? false);
      return { ok: true as const };
    },
  );
}
