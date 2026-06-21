// Render a project's cached CHANGELOG.md to HTML, sanitised, with a
// truncate tail. Pulled into its own module so the .astro page never
// has to host the marked / template-literal / regex soup that Astro's
// frontmatter parser gets twitchy about.

import { Marked } from 'marked';
import { getChangelog, getReadmeMeta } from './readme-cache';
import { sanitizeMarkdownHtml } from './sanitize-md-html';

const TRUNCATE = 12000;

export async function renderChangelogForRepo(owner: string, repo: string): Promise<string | null> {
  const slug = `${owner}__${repo}`;
  const cl = getChangelog(slug);
  if (!cl) return null;
  const branch = getReadmeMeta(slug)?.branch ?? 'main';
  const m = new Marked({ gfm: true, breaks: false });
  // Demote every author heading by two levels (h1→h3 … h4→h6) so
  // the changelog's headings rank below the disclosure summary's
  // implicit "section" level — same factor the README / body
  // renderers use for consistency.
  m.use({
    renderer: {
      heading(token: any) {
        const depth = Math.min(6, token.depth + 2);
        const text = this.parser.parseInline(token.tokens);
        return `<h${depth}>${text}</h${depth}>`;
      },
    },
  });
  const truncated = cl.length > TRUNCATE;
  const html = sanitizeMarkdownHtml(await m.parse(cl.slice(0, TRUNCATE)));
  const tail = truncated
    ? `<p class="changelog-more"><a href="https://github.com/${owner}/${repo}/blob/${branch}/CHANGELOG.md" target="_blank" rel="noopener">See full changelog on GitHub &#x2197;</a></p>`
    : '';
  return html + tail;
}
