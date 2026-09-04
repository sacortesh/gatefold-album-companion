const SOURCES = [
  { name: "Spotify", url: "https://www.spotify.com", note: "catalog and playback" },
  { name: "MusicBrainz", url: "https://musicbrainz.org", note: "release facts" },
  { name: "Wikipedia", url: "https://www.wikipedia.org", note: "album summaries" },
  { name: "Discogs", url: "https://www.discogs.com", note: "credits, notes, and cover images" },
  { name: "LRCLIB", url: "https://lrclib.net", note: "lyrics" },
  { name: "Cover Art Archive", url: "https://coverartarchive.org", note: "cover scans" },
];

/** A thank-you, not a bare link list — MusicBrainz, Discogs, and LRCLIB's
 *  own API terms all ask for attribution, and this is the one screen a
 *  self-hoster will actually read once (Phase 10.16). */
export function AttributionSettings() {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-ink">Thanks to</h2>
      <p className="text-sm text-ink-muted">
        Gatefold wouldn&apos;t have much to say about an album without these.
      </p>
      <ul className="space-y-1 text-sm">
        {SOURCES.map((s) => (
          <li key={s.name}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {s.name}
            </a>
            <span className="text-ink-muted"> · {s.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
