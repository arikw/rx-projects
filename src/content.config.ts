import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Optional per-project detail pages. The slug (filename without extension)
// must match a project's canonical id (GitHub repo name, npm package name,
// docker image, chrome slug, or manual entry slug). When a match exists,
// the loader sets the project's hasDetail=true and the card renders a
// "Details →" link to /projects/<slug>/.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    /** Optional override of the card title. */
    title: z.string().optional(),
    /** Optional override of the card description. */
    description: z.string().optional(),
    /** Optional override/extension of tags. Merged with source-fetched tags. */
    tags: z.array(z.string()).optional(),
    /** Cover image, colocated next to the .mdx file. */
    cover: z.string().optional(),
    /** Author for this detail page. Defaults to the site author. */
    author: z.string().default('Arik W.'),
  }),
});

export const collections = { projects };
