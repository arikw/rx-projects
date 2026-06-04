#!/usr/bin/env node
// Scaffold `projects.config.local.ts` from the git remote — extracts the
// GitHub user + repo, defaults the deployment to that fork's GitHub Pages
// URL, and pre-fills `user.github`. Cloners get a working dashboard in
// one command and only need to edit if they want to deviate.
//
//   npm run init             # bails if projects.config.local.ts exists
//   npm run init -- --force  # overwrite existing local config

import { existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const LOCAL_CONFIG = resolve(process.cwd(), 'projects.config.local.ts');
const FORCE = process.argv.includes('--force');

if (existsSync(LOCAL_CONFIG) && !FORCE) {
  console.error('projects.config.local.ts already exists.');
  console.error('Delete it or rerun with --force:  npm run init -- --force');
  process.exit(2);
}

let originUrl;
try {
  originUrl = execSync('git remote get-url origin', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  console.error('Could not read git remote origin. Are you inside a git clone?');
  console.error('Create projects.config.local.ts manually — see README step 3.');
  process.exit(2);
}

// Parse user/repo from either an HTTPS or SSH github URL.
const m = originUrl.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i);
if (!m) {
  console.error(`Could not parse a GitHub user/repo from origin: ${originUrl}`);
  console.error('Create projects.config.local.ts manually — see README step 3.');
  process.exit(2);
}
const user = m[1];
const repo = m[2];
const site = `https://${user}.github.io`;
const base = `/${repo}`;

const content = `import baseConfig from './projects.config';

// Scaffolded by \`npm run init\` from \`git remote get-url origin\`.
// Override only what you need; the base config keeps cloners from fighting
// upstream \`projects.config.ts\` updates when they pull bug fixes.
export default {
  ...baseConfig,
  deployment: {
    ...baseConfig.deployment,
    site: '${site}',
    base: '${base}',
  },
  user: {
    ...baseConfig.user,
    github: '${user}',
    // npm: '${user}',     // optional — defaults to user.github
    // docker: '${user}',  // optional — defaults to user.github
  },
  // sources: {
  //   ...baseConfig.sources,
  //   chrome: {
  //     ...baseConfig.sources.chrome,
  //     extensionIds: [
  //       // '<32-char-id-from-chromewebstore.google.com/detail/...>',
  //     ],
  //   },
  // },
  featured: [
    // 'slug-to-pin-at-the-top',
  ],
  manual: [
    // projects without an online source (closed-source, retired, etc.)
  ],
};
`;

writeFileSync(LOCAL_CONFIG, content);

const dim = process.stdout.isTTY ? '\x1b[2m' : '';
const bold = process.stdout.isTTY ? '\x1b[1m' : '';
const green = process.stdout.isTTY ? '\x1b[32m' : '';
const reset = process.stdout.isTTY ? '\x1b[0m' : '';

console.log(`${green}✓${reset} Wrote ${bold}projects.config.local.ts${reset}`);
console.log(`${dim}    deployment.site: ${reset}${site}`);
console.log(`${dim}    deployment.base: ${reset}${base}`);
console.log(`${dim}    user.github:     ${reset}${user}`);
console.log();
console.log(`${bold}Next${reset}:`);
console.log('  1. Edit projects.config.local.ts to add chrome extension IDs, featured slugs, manual entries (all optional).');
console.log('  2. npm run build      # try a local build to verify your handles connect');
console.log('  3. git push / dispatch deploy.yml — then npm run status to confirm.');
