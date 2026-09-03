# Gatefold — brand assets

- `icon.png` — 1024×1024 master, black squircle + white line art, transparent
  rounded corners. Source of every web favicon.
- `icon-square.png` — same art, opaque full black square (for places that add
  their own mask / ignore transparency, e.g. Apple touch icon, maskable PWA).
- `source/icon-original.svg` — the clean vector redraw of the mark (gatefold
  sleeve + record + note); current source of truth. `icon-original.xcf` is
  the GIMP working file behind it. `icon.png`/`icon-square.png` are this
  glyph composited onto a squircle/square at 1024×1024 (white fill,
  transparent background — see the regeneration commands below).
- `source/icon-original.jpeg` / `icon-original-nobg.png` — the earlier
  AI-generated image (Gemini) the mark was originally traced from before the
  vector redraw. Kept for provenance only, no longer the source of truth.

## Navbar

`packages/web/public/gatefold-mark.svg` (a copy of `source/icon-original.svg`)
is used as a CSS mask in `GatefoldMark.tsx`, so the in-app header mark
recolors via a Tailwind `bg-*` class instead of shipping a fixed-color raster.

The favicon set in `packages/web/public/` (`favicon.ico`, `favicon-96.png`,
`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`)
is regenerated from `icon.png` / `icon-square.png` with ImageMagick:

```sh
magick brand/icon.png -define icon:auto-resize=48,32,16 packages/web/public/favicon.ico
magick brand/icon.png -resize 96  packages/web/public/favicon-96.png
magick brand/icon.png -resize 192 packages/web/public/icon-192.png
magick brand/icon.png -resize 512 packages/web/public/icon-512.png
magick brand/icon-square.png -resize 180 packages/web/public/apple-touch-icon.png
magick brand/icon-square.png -resize 512 packages/web/public/icon-maskable-512.png
```
