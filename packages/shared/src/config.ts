import { z } from "zod";

/** `data/config/settings.json` */
export const settingsSchema = z.object({
  /** Spotify Connect device to target for playback control. */
  preferredDeviceId: z.string().nullable().default(null),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = { preferredDeviceId: null };

/**
 * `data/config/buttons.json`
 * MVP1: a single "banger" button. MVP2 turns this into an array.
 */
export const bangerButtonSchema = z.object({
  label: z.string().min(1).default("Banger"),
  /** Spotify playlist id (not URI) the track is added to. */
  playlistId: z.string().min(1),
  /** MVP1 is always true — Banger is a superset of Like. */
  autoLike: z.boolean().default(true),
  /** Single-key shortcut. */
  shortcut: z.string().min(1).max(1).default("b"),
});
export type BangerButton = z.infer<typeof bangerButtonSchema>;

export const buttonsSchema = z.object({
  banger: bangerButtonSchema,
});
export type Buttons = z.infer<typeof buttonsSchema>;

/** `data/config/backlog.json` */
export const backlogItemSchema = z.object({
  albumId: z.string().min(1),
  uri: z.string().min(1),
  addedAt: z.string(), // ISO date (YYYY-MM-DD)
  priority: z.number().int().default(0),
});
export type BacklogItem = z.infer<typeof backlogItemSchema>;

export const backlogSchema = z.object({
  items: z.array(backlogItemSchema).default([]),
});
export type Backlog = z.infer<typeof backlogSchema>;

/** `data/config/revisit.json` */
export const revisitItemSchema = z.object({
  albumId: z.string().min(1),
  reviewPath: z.string().min(1),
  addedAt: z.string(),
});
export type RevisitItem = z.infer<typeof revisitItemSchema>;

export const revisitSchema = z.object({
  items: z.array(revisitItemSchema).default([]),
});
export type Revisit = z.infer<typeof revisitSchema>;

/** Maps a config file name to its schema — used by the generic /api/config route. */
export const configSchemas = {
  settings: settingsSchema,
  buttons: buttonsSchema,
  backlog: backlogSchema,
  revisit: revisitSchema,
} as const;
export type ConfigName = keyof typeof configSchemas;
