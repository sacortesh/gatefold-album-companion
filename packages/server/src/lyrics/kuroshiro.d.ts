// Neither package ships types or has a @types/* package (both are
// years-stale on npm). Minimal ambient declarations for the surface
// this app actually calls.

declare module "kuroshiro" {
  export default class Kuroshiro {
    init(analyzer: unknown): Promise<void>;
    convert(
      str: string,
      options?: {
        to?: "hiragana" | "katakana" | "romaji";
        mode?: "normal" | "spaced" | "okurigana" | "furigana";
        romajiSystem?: "nippon" | "passport" | "hepburn";
      },
    ): Promise<string>;
  }
}

declare module "kuroshiro-analyzer-kuromoji" {
  export default class KuromojiAnalyzer {
    constructor(options?: { dictPath?: string });
  }
}
