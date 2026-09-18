import type {
  SuggestedAlbum,
  SuggestionRule,
  SuggestionSource,
  SuggestionsConfig,
} from "@gatefold/shared";
import { getAlbums, toAlbumSummary } from "./spotify/albums.js";
import { readConfig } from "./store/config.js";
import { readAllReviews } from "./store/reviews.js";

/** Cards shown in the "Play next" strip. */
const TOTAL_PICKS = 6;

const NEUTRAL_WEIGHTS = { backlog: 1, keep: 1, revisit: 1 };

interface ActiveRule {
  label: string | null;
  weights: { backlog: number; keep: number; revisit: number };
}

function ruleMatches(rule: SuggestionRule, day: number, hour: number): boolean {
  const prevDay = (day + 6) % 7;
  const wraps = rule.endHour <= rule.startHour;
  if (!wraps) {
    return rule.days.includes(day) && hour >= rule.startHour && hour < rule.endHour;
  }
  const startedToday = rule.days.includes(day) && hour >= rule.startHour;
  const continuesFromYesterday = rule.days.includes(prevDay) && hour < rule.endHour;
  return startedToday || continuesFromYesterday;
}

/** Picks the first rule (in list order) whose day/hour window contains
 *  `now`, read against the server's own local clock (no timezone config —
 *  see `suggestionsConfigSchema`'s own doc comment for why). Falls back to
 *  an even 1/1/1 split — not an error state, just "no bias configured (or
 *  none matches right now)." */
export function resolveActiveRule(
  config: SuggestionsConfig,
  now: Date = new Date(),
): ActiveRule {
  if (!config.enabled) return { label: null, weights: NEUTRAL_WEIGHTS };

  const day = now.getDay();
  const hour = now.getHours();
  const match = config.rules.find((r) => ruleMatches(r, day, hour));
  return match
    ? { label: match.label, weights: match.weights }
    : { label: null, weights: NEUTRAL_WEIGHTS };
}

/** Largest-remainder apportionment of `total` picks across the three
 *  sources, proportional to `weights`. Doesn't backfill a source's
 *  shortfall from the others if its own pool runs dry (e.g. an empty
 *  Revisit queue) — a simplification worth revisiting if it turns out to
 *  matter in practice. */
function allocatePickCounts(
  weights: ActiveRule["weights"],
  total: number,
): Record<SuggestionSource, number> {
  const sum = weights.backlog + weights.keep + weights.revisit;
  if (sum <= 0) return allocatePickCounts(NEUTRAL_WEIGHTS, total);

  const raw: Record<SuggestionSource, number> = {
    backlog: (weights.backlog / sum) * total,
    keep: (weights.keep / sum) * total,
    revisit: (weights.revisit / sum) * total,
  };
  const counts: Record<SuggestionSource, number> = {
    backlog: Math.floor(raw.backlog),
    keep: Math.floor(raw.keep),
    revisit: Math.floor(raw.revisit),
  };
  let remaining = total - (counts.backlog + counts.keep + counts.revisit);
  const bySourceRemainder = (Object.keys(raw) as SuggestionSource[])
    .map((source) => ({ source, frac: raw[source] - counts[source] }))
    .sort((a, b) => b.frac - a.frac);
  for (const { source } of bySourceRemainder) {
    if (remaining <= 0) break;
    counts[source] += 1;
    remaining -= 1;
  }
  return counts;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** Every album id currently sitting in each source — the whole pool, not
 *  a recent-N slice. A recency cap would work directly against the point
 *  of biasing toward Backlog at certain hours: surfacing albums that have
 *  been sitting unplayed, not just the newest additions. */
async function collectPools(): Promise<Record<SuggestionSource, string[]>> {
  const [backlog, revisit, reviews] = await Promise.all([
    readConfig("backlog"),
    readConfig("revisit"),
    readAllReviews(),
  ]);

  return {
    backlog: backlog.items.map((i) => i.albumId),
    revisit: revisit.items.map((i) => i.albumId),
    keep: reviews.filter((r) => r.verdict === "keep").map((r) => r.albumId),
  };
}

interface SuggestionsResult {
  albums: SuggestedAlbum[];
  activeRule: string | null;
}

/** "What to play next" (Phase 12.3) — picks real albums already sitting in
 *  Backlog / Keep / Revisit, weighted by whatever time-of-day/day-of-week
 *  rule currently applies. Deliberately *not* new-album discovery (that's
 *  12.2's per-album "Similar Albums" strip, `GET /album/:id/similar`) —
 *  an earlier version of this route seeded Last.fm discovery from these
 *  same three sources, which meant the backlog itself never got worked
 *  down; recommending only things you already have is the actual point.
 *  No caching needed: everything here is a local config read plus one
 *  `getAlbums` batch (itself already cached), so a fresh shuffle on every
 *  call is both cheap and desirable — variety, not staleness risk. */
export async function getSuggestions(): Promise<SuggestionsResult> {
  const config = await readConfig("suggestions");
  const { label: activeRule, weights } = resolveActiveRule(config);

  const pools = await collectPools();
  const counts = allocatePickCounts(weights, TOTAL_PICKS);

  const picked = new Set<string>();
  const order: Array<{ id: string; source: SuggestionSource }> = [];
  for (const source of ["backlog", "keep", "revisit"] as const) {
    const chosen = shuffle(pools[source]).filter((id) => !picked.has(id));
    for (const id of chosen.slice(0, counts[source])) {
      picked.add(id);
      order.push({ id, source });
    }
  }

  if (order.length === 0) return { albums: [], activeRule };

  const rawAlbums = await getAlbums(order.map((o) => o.id));
  const albums: SuggestedAlbum[] = order.flatMap(({ id, source }) => {
    const raw = rawAlbums.get(id);
    return raw ? [{ album: toAlbumSummary(raw), source }] : [];
  });

  return { albums, activeRule };
}
