// Minimal HTML safety pass for embedded markdown HTML. Not a full DOM
// sanitizer — kills the obvious vectors: script blocks, iframes, on*
// event handlers, and javascript: hrefs. For our own READMEs this is
// overkill; for any future "show README of an external project"
// feature it's a floor.
//
// Lives in its own module because Astro's frontmatter parser gets
// upset when source HTML-shaped patterns live inside a .astro file.

const SCRIPT_TAG_RE = new RegExp('<script\\b[^>]*>[\\s\\S]*?<' + '/script\\s*>', 'gi');
const IFRAME_TAG_RE = new RegExp('<iframe\\b[^>]*>[\\s\\S]*?<' + '/iframe\\s*>', 'gi');
const OBJECT_TAG_RE = new RegExp('<object\\b[^>]*>[\\s\\S]*?<' + '/object\\s*>', 'gi');

export function sanitizeMarkdownHtml(html: string): string {
  return html
    .replace(SCRIPT_TAG_RE, '')
    .replace(IFRAME_TAG_RE, '')
    .replace(OBJECT_TAG_RE, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'");
}
