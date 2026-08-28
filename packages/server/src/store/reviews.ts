import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  reviewFrontmatterSchema,
  type Review,
  type ReviewFrontmatter,
} from "@spotify-companion/shared";
import { CONFIG_DIR, REVIEWS_DIR, ROOT } from "../paths.js";

/** Fallback when `data/config/review-template.md` is missing. */
const DEFAULT_REVIEW_TEMPLATE = [
  "## First impression",
  "Gut reaction before overthinking it — what did the first listen feel like?",
  "",
  "## Sound & production",
  "Textures, mix, dynamics. Does the production serve the songs?",
  "",
  "## Songwriting & structure",
  "Melodies, arrangements, pacing. Which tracks are the spine of the record?",
  "",
  "## Lyrics & themes",
  "What is it about? Does the writing hold up on its own?",
  "",
  "## Standout tracks",
  "Two to four that define the album, and why.",
  "",
  "## As a whole",
  "Does it work as an album — sequencing, cohesion, arc — or is it a playlist?",
  "",
  "## Where it sits",
  "Against the artist's other work, its scene, its era. Why does this one matter?",
  "",
  "## Verdict rationale",
  "Why Keep / Revisit / Pass / Delete. Would I come back to it in a year?",
  "",
].join("\n");

export async function readReviewTemplate(): Promise<string> {
  try {
    const raw = await readFile(
      path.join(CONFIG_DIR, "review-template.md"),
      "utf8",
    );
    return raw.trim() ? raw : DEFAULT_REVIEW_TEMPLATE;
  } catch {
    return DEFAULT_REVIEW_TEMPLATE;
  }
}

function slug(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "untitled";
}

const fileName = (fm: Pick<ReviewFrontmatter, "artist" | "album">): string =>
  `${slug(fm.artist)}-${slug(fm.album)}.md`;

function pathFor(fm: ReviewFrontmatter): string {
  const year =
    /^\d{4}/.exec(fm.listenedOn)?.[0] ?? String(new Date().getFullYear());
  return path.join(REVIEWS_DIR, year, fileName(fm));
}

const relPath = (abs: string): string => path.relative(ROOT, abs);

export async function writeReview(
  fm: ReviewFrontmatter,
  notes: string,
): Promise<Review> {
  const abs = pathFor(fm);
  await mkdir(path.dirname(abs), { recursive: true });
  const body = notes.trim() ? `\n${notes.trim()}\n` : "\n";

  // js-yaml can't serialise `undefined` — drop absent optionals.
  const frontmatter = Object.fromEntries(
    Object.entries(fm).filter(([, v]) => v !== undefined),
  );
  await writeFile(abs, matter.stringify(body, frontmatter), "utf8");

  return { ...fm, notes: notes.trim(), path: relPath(abs) };
}

export async function readAllReviews(): Promise<Review[]> {
  let years: string[];
  try {
    years = await readdir(REVIEWS_DIR);
  } catch {
    return [];
  }

  const reviews: Review[] = [];
  for (const year of years) {
    const dir = path.join(REVIEWS_DIR, year);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const abs = path.join(dir, f);
      const parsed = matter(await readFile(abs, "utf8"));
      const fm = reviewFrontmatterSchema.safeParse(parsed.data);
      if (!fm.success) continue;
      reviews.push({
        ...fm.data,
        notes: parsed.content.trim(),
        path: relPath(abs),
      });
    }
  }
  return reviews.sort((a, b) => b.listenedOn.localeCompare(a.listenedOn));
}

export async function findReview(albumId: string): Promise<Review | null> {
  return (await readAllReviews()).find((r) => r.albumId === albumId) ?? null;
}
