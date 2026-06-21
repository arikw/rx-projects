// Shared title-resolution helper. The "raw" title for a project is
// whatever the loader assembled (e.g. the GitHub repo name, the CWS
// extension title). For many GitHub-only projects that's a kebab-case
// slug — ugly on a card. This helper:
//
//   1. If the title is slug-like (`my-thing`, `foo_bar`, `baz.qux`)
//      AND a cached README exists, swaps in the README's first H1.
//   2. Trims long titles at the first " — " / " - " / " | " separator
//      so the tagline tail ("...— talk to your AI coding agent from
//      anywhere") is dropped and only the brand name remains.
//
// The function is pure: it reads from the readme-cache via the slug
// resolver and never calls fetch. Safe to call at build time from
// any component.

import { readmeSlugFromSourceUrl, getReadmeCacheState } from './readme-cache';
import type { Project } from '../types/project';

/** True when the input reads like a kebab/dot/underscore-separated
 *  slug (optionally namespaced with a forward slash like
 *  `org/repo` — common for Docker Hub `<owner>/<image>` titles)
 *  rather than a human-written title. */
export function isSlugLike(s: string): boolean {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)?$/.test(s.trim());
}

/** Pull the first ATX-style H1 line out of a markdown document, with
 *  surrounding markdown inline syntax stripped. */
export function extractFirstH1(markdown: string): string | null {
  const m = markdown.match(/^\s*#\s+(.+?)\s*$/m);
  if (!m) return null;
  return m[1]
    .replace(/^\*+(.+?)\*+$/, '$1')
    .replace(/^`(.+?)`$/, '$1')
    .replace(/^\[(.+?)\]\([^)]+\)$/, '$1')
    .trim() || null;
}

/** Trim long titles at the first " — " / " - " / " | " separator.
 *  Returns the leading brand name; leaves short titles alone. The
 *  threshold prevents disambiguating tails like "BabyTV - Memory Game"
 *  from being lost — only sentence-length taglines past the separator
 *  are stripped. */
export function trimAfterSeparator(title: string, minLengthToTrim = 30): string {
  if (title.length <= minLengthToTrim) return title;
  // Em-dash, en-dash, ASCII hyphen, pipe — all common tagline delimiters.
  // Surrounding spaces are required so we don't split compound words
  // like "live-dev-portfolio".
  const m = title.match(/^(.+?)\s+(?:[—–-]|\|)\s+.+$/);
  if (!m) return title;
  const head = m[1].trim();
  return head.length >= 3 ? head : title;
}

/** Max length for a body-H1 swap. Sentence-length headings (e.g.
 *  Docker Hub `# Proof of Concept: Controlling a Virtual Android
 *  Device with Various Debug Tools Using VirtualBox and Docker`)
 *  technically ARE the project's "title" but read as a paragraph;
 *  past this threshold we'd rather keep the slug. */
const MAX_BODY_H1_LENGTH = 60;

/** Strip the `<owner>/` namespace prefix from Docker-style titles
 *  (`arikwe/docker-compose-webhook` → `docker-compose-webhook`).
 *  The "Find it on" chip on the detail page / card already tells the
 *  user where the project lives, so the owner segment is redundant
 *  in the title. Only fires when the input is slug-like. */
function stripNamespace(title: string): string {
  const m = title.match(/^[a-z0-9]+(?:[._-][a-z0-9]+)*\/(.+)$/);
  return m ? m[1] : title;
}

/** Resolve the best title to show on cards / detail pages for a
 *  given project. Falls back through: trim → README h1 → body h1 →
 *  namespace-stripped slug.
 *
 *  Body-h1 fallback covers Docker Hub images (the slug-like project
 *  id is the title, and Docker's `full_description` lives in
 *  `project.body`) and other manual / connector-supplied bodies
 *  whose author wrote a heading inside the long description. */
export function resolveDisplayTitle(project: Project): string {
  let title = project.title;
  if (isSlugLike(title)) {
    let h1: string | null = null;
    const ref = readmeSlugFromSourceUrl(project.sourceUrl);
    if (ref) {
      const state = getReadmeCacheState(ref.slug);
      if (state.readme) h1 = extractFirstH1(state.readme);
    }
    if (!h1 && project.body) h1 = extractFirstH1(project.body);
    // Swap to the body H1 only when it's a meaningful improvement —
    // not itself a slug (would trade one ugly identifier for another)
    // AND not sentence-length (Docker's "Proof of Concept: …" h1).
    // When we don't swap, drop the `<owner>/` namespace at least, so
    // "arikwe/docker-compose-webhook" still loses its redundant prefix.
    const swapOk =
      h1 != null &&
      !isSlugLike(h1) &&
      h1.length <= MAX_BODY_H1_LENGTH &&
      h1.toLowerCase() !== title.toLowerCase();
    title = swapOk ? (h1 as string) : stripNamespace(title);
  }
  return trimAfterSeparator(title);
}
