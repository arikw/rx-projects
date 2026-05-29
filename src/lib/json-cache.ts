// Tiny JSON cache helper for fetch-once connectors (removed Google Play apps,
// whose stats are frozen). Resolved relative to cwd (project root under `npm
// run`), not the module URL — which moves into dist/ after Astro bundles.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function readJsonCache<T>(relPath: string, fallback: T): T {
  const path = resolve(process.cwd(), relPath);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (err) {
    console.warn(`[cache] read failed for ${relPath}, starting empty:`, err);
    return fallback;
  }
}

export function writeJsonCache(relPath: string, data: unknown): void {
  const path = resolve(process.cwd(), relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
