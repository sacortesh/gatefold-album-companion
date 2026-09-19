import { createRequire } from "node:module";
import type { FuriganaSegment } from "@gatefold/shared";
import { transliterate } from "transliteration";

// Detected once over the *whole* lyrics text, not per line — real songs
// don't mix scripts mid-track. Kanji-only text is ambiguous with Chinese,
// so Japanese requires hiragana/katakana presence rather than bare Han.
const HIRAGANA_OR_KATAKANA = /\p{Script=Hiragana}|\p{Script=Katakana}/u;
const HANGUL = /\p{Script=Hangul}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;

export type Script = "latin" | "cyrillic" | "hangul" | "japanese";

/** `null` only means "no text to analyze" — every non-empty lyric gets a
 *  definite tag (Phase 11.3), `"latin"` included, so Backlog/Revisit/Reviews
 *  can filter by language even for the majority of tracks that need no
 *  romanization at all. */
export function detectScript(text: string): Script | null {
  if (!text.trim()) return null;
  if (HIRAGANA_OR_KATAKANA.test(text)) return "japanese";
  if (HANGUL.test(text)) return "hangul";
  if (CYRILLIC.test(text)) return "cyrillic";
  return "latin";
}

// @romanize/korean's CJS build assigns exports via property getters, which
// Node's static cjs-module-lexer can't see — named ESM imports silently
// resolve to undefined. `require` sidesteps the lexer entirely.
const require = createRequire(import.meta.url);
const koreanRomanize = require("@romanize/korean") as {
  romanize(hangul: string): string;
};

// kuroshiro + its kuromoji IPADIC dictionary (~17MB) are only imported
// inside this lazy singleton, on first Japanese track — server boot and
// memory stay unaffected for the large majority of users who never hit one.
let kuroshiroInit: Promise<import("kuroshiro").default> | null = null;

async function getKuroshiro() {
  if (!kuroshiroInit) {
    kuroshiroInit = (async () => {
      const [{ default: Kuroshiro }, { default: KuromojiAnalyzer }] =
        await Promise.all([
          import("kuroshiro"),
          import("kuroshiro-analyzer-kuromoji"),
        ]);
      const instance = new Kuroshiro();
      await instance.init(new KuromojiAnalyzer());
      return instance;
    })();
  }
  return kuroshiroInit;
}

export async function romanize(text: string, script: Script): Promise<string> {
  if (!text.trim()) return text;
  switch (script) {
    case "japanese": {
      const instance = await getKuroshiro();
      return instance.convert(text, {
        to: "romaji",
        mode: "spaced",
        romajiSystem: "hepburn",
      });
    }
    case "hangul":
      return koreanRomanize.romanize(text);
    case "cyrillic":
      return transliterate(text);
    case "latin":
      return text;
  }
}

// kuroshiro's furigana mode returns HTML like `<ruby>感<rp>(</rp><rt>かん
// </rt><rp>)</rp></ruby>じ取れたら...` — plain (non-kanji) runs pass through
// completely unescaped, verified against real lyric text. This regex pulls
// out the deterministic ruby markup kuroshiro itself generates; the plain
// runs in between are captured as opaque text, never interpreted as markup.
const RUBY_TAG =
  /<ruby>(.*?)<rp>\(<\/rp><rt>(.*?)<\/rt><rp>\)<\/rp><\/ruby>/gs;

function parseFuriganaHtml(html: string): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];
  let lastIndex = 0;
  for (const m of html.matchAll(RUBY_TAG)) {
    if (m.index > lastIndex) {
      segments.push({ text: html.slice(lastIndex, m.index), reading: null });
    }
    segments.push({ text: m[1] ?? "", reading: m[2] ?? null });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < html.length) {
    segments.push({ text: html.slice(lastIndex), reading: null });
  }
  return segments;
}

/** Japanese only (Phase 11.2) — kanji with kana readings, read as actual
 *  Japanese rather than converted to Latin letters. Reuses the same
 *  `kuroshiro` singleton as `romanize()`, different output mode. */
export async function furigana(text: string): Promise<FuriganaSegment[]> {
  if (!text.trim()) return [{ text, reading: null }];
  const instance = await getKuroshiro();
  const html = await instance.convert(text, {
    to: "hiragana",
    mode: "furigana",
  });
  return parseFuriganaHtml(html);
}
