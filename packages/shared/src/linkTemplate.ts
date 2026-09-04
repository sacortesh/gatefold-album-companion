/** `{artist}`/`{album}`/`{track}` placeholders, percent-encoded on
 *  substitution with spaces as `+` (matches how every one of the default
 *  templates' own search/path routing was verified to accept them). Used
 *  server-side for album-level "About this album" links and client-side
 *  for the track-level lyrics-search fallback — same function either side
 *  so the two never drift. */
export function renderLinkTemplate(
  urlTemplate: string,
  vars: Record<string, string>,
): string {
  return Object.entries(vars).reduce(
    (url, [key, value]) =>
      url.replaceAll(
        `{${key}}`,
        encodeURIComponent(value).replace(/%20/g, "+"),
      ),
    urlTemplate,
  );
}
