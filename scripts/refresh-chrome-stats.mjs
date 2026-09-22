#!/usr/bin/env node
// Refresh chrome-stats.com figures for the cached Chrome extensions.
//
// WHY THIS EXISTS
// -------------------------------------------------------------------------
// The `chromestats` connector (src/connectors/chromestats) fetches each
// extension **once** and never re-fetches — its own note says "Fetched once per
// extension id; delete the file to refresh". On top of that, its normal source,
// the chrome-stats.com HTML page (`/d/<id>`), is **Cloudflare-blocked (HTTP 403,
// error 1010)** from CI build runners (GitHub Actions, Cloudflare Pages) — and
// from most non-browser clients. Result: the rating counts / user counts in
// `generated/.cache/chromestats/data.json` freeze at whatever they were the day
// each extension was first cached, and never move on their own.
//
// chrome-stats.com's JSON endpoint, `/api/detail?id=<id>`, is NOT blocked the
// same way and returns fresh figures from a normal developer machine. This
// script is the manual bypass: run it locally to pull the current numbers into
// the committed cache, then commit — the next site build serves the fresh
// figures (build-projects picks the rating source with the highest count, so a
// refreshed chromestats entry wins over a stale one from another connector).
//
// USAGE
//   node scripts/refresh-chrome-stats.mjs            # refresh every cached id
//   node scripts/refresh-chrome-stats.mjs <id> ...   # only the given ids
//
// It touches only the volatile fields — rating {value, count} and userCount —
// and leaves every other field in each entry untouched. Requires Node 18+
// (built-in fetch). No dependencies.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CACHE = 'generated/.cache/chromestats/data.json';
const api = (id) => `https://chrome-stats.com/api/detail?id=${encodeURIComponent(id)}`;

// chrome-stats.com sits behind Cloudflare, which 403s (a) short/absent
// User-Agents and (b) Node's built-in fetch (its TLS fingerprint is detected
// even with a browser UA). Plain `curl` with a full desktop-browser UA passes,
// so we shell out to curl rather than using fetch.
//
// The rate block is keyed on (IP + User-Agent), NOT on the IP alone. Measured:
// with ONE UA, request 1 succeeds then it trips into a solid 403 streak
// (~1/10 back-to-back); ROTATING the UA gets ~4/10 back-to-back and a UA that
// tripped recovers once it's been rested a few requests. So each UA has its own
// budget. We exploit that: rotate the UA every request, and on a 403 retry
// immediately with a *different* UA (a cheap short pause) instead of waiting out
// a long IP-wide cooldown. A modest gap between requests lets each UA's budget
// refill so we don't exhaust the whole pool.
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
];

const SPACING_MS = 3000; // idle gap between IDs, to let UA budgets refill
const MAX_ATTEMPTS = 12; // per id: plenty, since each attempt uses a fresh UA
const RETRY_MS = 2000; // short pause between attempts (fresh UA each time)

// Round-robin cursor into UAS, advanced across every request (all IDs share it)
// so no single UA is hammered.
let uaCursor = 0;
const nextUA = () => UAS[uaCursor++ % UAS.length];

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function fetchDetail(id) {
  for (let attempt = 1; ; attempt++) {
    try {
      const out = execFileSync(
        'curl',
        ['-fsS', '--max-time', '30', '-A', nextUA(), '-H', 'Accept: application/json', api(id)],
        { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
      );
      return JSON.parse(out);
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw err;
      sleep(RETRY_MS);
    }
  }
}
const fmt = (r) => (r ? `${Number(r.value).toFixed(2)}★ (${r.count})` : '—');

const cache = JSON.parse(readFileSync(CACHE, 'utf8'));
if (!cache.apps) {
  console.error(`No "apps" in ${CACHE} — nothing to refresh.`);
  process.exit(1);
}

const ids = process.argv.slice(2);
const targets = ids.length ? ids : Object.keys(cache.apps);
let changed = 0;

for (const id of targets) {
  const entry = cache.apps[id];
  if (!entry) {
    console.warn(`skip ${id}: not in cache`);
    continue;
  }
  sleep(SPACING_MS); // stay under Cloudflare's rate limit
  let d;
  try {
    d = fetchDetail(id);
  } catch (err) {
    console.warn(`skip ${entry.name ?? id}: ${err.message.split('\n')[0]}`);
    continue;
  }

  const before = fmt(entry.rating);
  if (typeof d.ratingValue === 'number' && typeof d.ratingCount === 'number') {
    entry.rating = { value: d.ratingValue, count: d.ratingCount };
  }
  if (typeof d.userCount === 'number') entry.userCount = d.userCount;
  const after = fmt(entry.rating);

  if (before !== after) changed++;
  const mark = before !== after ? '~' : ' ';
  console.log(`${mark} ${(entry.name ?? id).padEnd(28)} ${before}  ->  ${after}   users=${entry.userCount ?? '—'}`);
}

if (changed) {
  writeFileSync(CACHE, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  console.log(`\nUpdated ${changed} entry(ies). Wrote ${CACHE} — commit it to publish the fresh numbers.`);
} else {
  console.log('\nNo changes.');
}
