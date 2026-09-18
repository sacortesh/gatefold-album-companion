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
  /** Spotify playlist id (not URI) the track is added to. Empty until set
   *  in Settings — routes treat "" the same as unset (409 on /banger). */
  playlistId: z.string().default(""),
  /** MVP1 is always true — Banger is a superset of Like. */
  autoLike: z.boolean().default(true),
  /** Single-key shortcut. */
  shortcut: z.string().min(1).max(1).default("b"),
});
export type BangerButton = z.infer<typeof bangerButtonSchema>;

export const buttonsSchema = z.object({
  banger: bangerButtonSchema.default({}),
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

/**
 * `data/config/links.json` — user-configurable external link templates
 * (Phase 10.11/10.12). `album` templates render into `AlbumContext.links`
 * (needs `{artist}`/`{album}`); `track` templates are the lyrics-search
 * fallback shown in `LyricsPanel` when LRCLIB has nothing (needs
 * `{artist}`/`{track}`). `urlTemplate`s below were verified live against
 * the real sites, not guessed — see docs/implementation-plan.md 10.11/10.12.
 */
export const linkTemplateSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  enabled: z.boolean().default(true),
  urlTemplate: z.string().min(1),
});
export type LinkTemplate = z.infer<typeof linkTemplateSchema>;

const DEFAULT_ALBUM_LINKS: LinkTemplate[] = [
  {
    id: "rym",
    label: "Rate Your Music",
    enabled: true,
    urlTemplate:
      "https://rateyourmusic.com/search?searchterm={artist}+{album}&searchtype=l",
  },
  {
    id: "metal-archives",
    label: "Encyclopaedia Metallum",
    enabled: true,
    urlTemplate:
      "https://www.metal-archives.com/search?searchString={artist}&type=band_name",
  },
  {
    id: "lastfm",
    label: "Last.fm",
    enabled: true,
    urlTemplate: "https://www.last.fm/music/{artist}/{album}",
  },
];

const DEFAULT_TRACK_LINKS: LinkTemplate[] = [
  {
    id: "genius",
    label: "Genius",
    enabled: true,
    urlTemplate: "https://genius.com/search?q={artist}+{track}",
  },
  {
    id: "songmeanings",
    label: "SongMeanings",
    enabled: true,
    urlTemplate: "https://songmeanings.com/query/?query={artist}+{track}",
  },
];

export const linksSchema = z.object({
  album: z.array(linkTemplateSchema).default(DEFAULT_ALBUM_LINKS),
  track: z.array(linkTemplateSchema).default(DEFAULT_TRACK_LINKS),
});
export type LinksConfig = z.infer<typeof linksSchema>;

/**
 * `data/config/suggestions.json` — the Phase 12.3 backlog suggester's
 * time-of-day/day-of-week weighting map. Reads the server's own local
 * clock (own decision, 2026-09-17): every other setting in this
 * single-user, self-hosted app is unscoped to timezone, and a timezone
 * field only matters for the edge case of self-hosting on a box outside
 * your own timezone — not worth the extra Settings field/config
 * complexity for v1. Off (`enabled: false`, no rules) by default —
 * inert until configured, not guessed.
 */
export const suggestionRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** 0 = Sunday .. 6 = Saturday, multi-select. */
  days: z.array(z.number().int().min(0).max(6)).min(1),
  /** Inclusive. */
  startHour: z.number().int().min(0).max(23),
  /** Exclusive; `endHour < startHour` wraps past midnight. */
  endHour: z.number().int().min(0).max(23),
  /** Relative, not required to sum to 1 — normalized when used. */
  weights: z.object({
    backlog: z.number().min(0),
    keep: z.number().min(0),
    revisit: z.number().min(0),
  }),
});
export type SuggestionRule = z.infer<typeof suggestionRuleSchema>;

export const suggestionsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  rules: z.array(suggestionRuleSchema).default([]),
});
export type SuggestionsConfig = z.infer<typeof suggestionsConfigSchema>;

/** Maps a config file name to its schema — used by the generic /api/config route. */
export const configSchemas = {
  settings: settingsSchema,
  buttons: buttonsSchema,
  backlog: backlogSchema,
  revisit: revisitSchema,
  links: linksSchema,
  suggestions: suggestionsConfigSchema,
} as const;
export type ConfigName = keyof typeof configSchemas;
