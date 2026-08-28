/** Bare id, `spotify:album:ID`, or an open.spotify.com/album/ID URL → id. */
export function parseAlbumId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9]{22}$/.test(s)) return s;
  return (
    s.match(/spotify:album:([A-Za-z0-9]{22})/)?.[1] ??
    s.match(/open\.spotify\.com\/album\/([A-Za-z0-9]{22})/)?.[1] ??
    null
  );
}
