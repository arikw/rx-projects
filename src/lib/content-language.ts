/** Heuristic content-language identification for short metadata strings
 *  (page titles, descriptions). "Content language" follows the HTTP
 *  Content-Language semantics: the human language the resource's
 *  content is written in. The default-when-unknown is English (returned
 *  as null); connectors only emit a language code when their heuristic
 *  explicitly identifies one. The UI treats null as English.
 *
 *  Start scope: Hebrew vs the rest. Detection counts characters in the
 *  Hebrew Unicode ranges vs Latin letters; >= 50% Hebrew of the
 *  alphabetic characters returns 'he'. Anything else returns null.
 *
 *  The 50% threshold is deliberately conservative — better to default
 *  to English on a mixed string than mistag a project. */

/** Hebrew Unicode ranges: main block + presentation forms. */
const HEBREW_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0590, 0x05ff], // Hebrew block (letters, vowels, punctuation, cantillation)
  [0xfb1d, 0xfb4f], // Hebrew Presentation Forms
];

function inAnyRange(cp: number, ranges: typeof HEBREW_RANGES): boolean {
  for (const [lo, hi] of ranges) if (cp >= lo && cp <= hi) return true;
  return false;
}

function isHebrewLetter(cp: number): boolean {
  return inAnyRange(cp, HEBREW_RANGES);
}

function isLatinLetter(cp: number): boolean {
  return (
    (cp >= 0x0041 && cp <= 0x005a) || // A-Z
    (cp >= 0x0061 && cp <= 0x007a) || // a-z
    (cp >= 0x00c0 && cp <= 0x024f) // Latin-1 Supplement + Extended A/B (accented letters)
  );
}

/** Returns `'he'` when Hebrew dominates the alphabetic characters in
 *  `text`, otherwise null. Null is the "default English" sentinel —
 *  callers should treat it as English in UI filters. */
export function detectContentLanguage(text?: string | null): string | null {
  if (!text) return null;
  let hebrew = 0;
  let latin = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (isHebrewLetter(cp)) hebrew++;
    else if (isLatinLetter(cp)) latin++;
  }
  const totalLetters = hebrew + latin;
  if (totalLetters === 0) return null;
  if (hebrew / totalLetters >= 0.5) return 'he';
  return null;
}

/** Friendly label for a language code, for filter-chip rendering. */
export function contentLanguageLabel(code: string): string {
  switch (code) {
    case 'en':
      return 'English';
    case 'he':
      return 'Hebrew';
    default:
      return code;
  }
}
