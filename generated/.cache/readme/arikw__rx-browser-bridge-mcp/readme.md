# rx-browser-bridge

POC for driving any browser tab from a Claude Code session via a
self-hosted relay + MV3 extension.

| | |
|---|---|
| **Status** | v0.1.0 — walking-skeleton POC |
| **Stack** | Node.js ≥ 20, TypeScript, MV3 browser extension |
| **License** | MIT |

## Pieces

```
┌──────────────────┐   HTTP POST /enqueue       ┌──────────────────┐
│ Claude Code      │ ─────────────────────────▶ │                  │
│  ↳ mcp/server.ts │   GET /poll/:cmd_id (long) │     relay/       │
│     (per-tool    │ ◀───────────────────────── │  (Node, sqlite)  │
│      call)       │                            │                  │
└──────────────────┘                            └────────┬─────────┘
                                                         │ WebSocket
                                                         │ ws://relay/ws
                                                         ▼
                                                 ┌──────────────────┐
                                                 │  extension/      │
                                                 │  (MV3, Chromium  │
                                                 │   or Firefox)    │
                                                 └──────────────────┘
```

- **relay/** — Node HTTP+WS server. Accepts CC's POST `/enqueue`,
  routes to extension over WS, returns result via long-poll `/poll`.
  Bearer-token auth (POSTER for CC, PULLER for extension). sqlite for
  audit log.
- **mcp/** — MCP stdio server loaded by Claude Code. Tools: see
  [Command set](#command-set-current).
- **extension/** — Manifest v3 extension. Persistent WS to relay,
  dispatches commands to active tab via `chrome.scripting.executeScript`
  + `chrome.tabs.captureVisibleTab`. Notification-based confirmation
  prompt for destructive actions (submit/post/send buttons, password
  fields).

## Install

Five steps. Each one ends with a check, so you know it worked before you
move on. Once done, the browser tools are available in **every** Claude
Code session, whichever directory you launch from.

**You need:** Node.js 20 or newer, Docker or Podman, Claude Code (or
another MCP client), and Chrome / Chromium / Edge / Brave **or** Firefox
128+. The commands are for Linux and macOS.

**How the pieces fit:** the *relay* is a small server you run. The
*browser extension* connects to it, and so does the *MCP server* that
Claude Code starts. Each connection has its own password (token), and
both tokens live in one file, `.env`:

| Token in `.env` | Who uses it | Where you put it |
|---|---|---|
| `PULLER_TOKEN` | the browser extension | paste it into the extension's Options page (step 4) |
| `POSTER_TOKEN` | the MCP server | nowhere: it reads `.env` itself (step 5) |

The examples clone into `~/tools/rx-browser-bridge-mcp`. Any place works;
just use the same path in step 5.

### 1. Get the code and build the MCP server

```bash
git clone https://github.com/arikw/rx-browser-bridge-mcp ~/tools/rx-browser-bridge-mcp
cd ~/tools/rx-browser-bridge-mcp
PUPPETEER_SKIP_DOWNLOAD=true npm install
npm -w mcp run build
```

**Check:** `ls mcp/dist/server.js` shows the file. (It isn't in git; you
must build it.)

`PUPPETEER_SKIP_DOWNLOAD=true` only skips a browser download used by the
tests.

### 2. Create `.env` with two random tokens

```bash
cp .env.example .env
sed -i.bak \
  -e "s/^POSTER_TOKEN=.*/POSTER_TOKEN=$(openssl rand -hex 32)/" \
  -e "s/^PULLER_TOKEN=.*/PULLER_TOKEN=$(openssl rand -hex 32)/" .env && rm .env.bak
```

**Check:** `grep TOKEN .env` shows two long random values, not `replace-me`.

Keep `PORT=3000` unless that port is taken. If you change it, use the new
port everywhere below where you see `3000`.

### 3. Start the relay

Run it in a container (recommended; it keeps running in the background):

```bash
cd relay
docker compose up -d --build        # or: podman compose up -d --build
cd ..
```

Without compose:

```bash
cd relay
docker build -t rx-browser-bridge-relay .
docker run -d --name rx-browser-bridge-relay --restart unless-stopped \
  -p 127.0.0.1:3000:3000 --env-file ../.env \
  -e DATA_DIR=/data -v "$PWD/data:/data" rx-browser-bridge-relay
cd ..
```

Or straight on the machine, in the foreground: `npm -w relay run dev`.

**Check:** `curl http://localhost:3000/health` answers with JSON.

The relay listens only on this machine (`127.0.0.1`). Its log is in
`relay/data/relay.sqlite`.

### 4. Load the extension into your browser

**Chrome / Chromium / Edge / Brave**

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. **Load unpacked** → choose the `extension/` folder.
3. Optional but recommended: open the extension's **Details** and turn on
   **Allow user scripts**. Without it, the `evaluate` tool doesn't work
   on sites that block running code, such as GitHub.

**Firefox (128 or newer)**

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** → choose `extension/manifest.json`.
3. Open `about:addons` → RX MCP Browser Bridge → **Permissions**, and
   allow access to all websites, if it isn't on already.

A temporary add-on is removed when Firefox closes, so you repeat these
steps after each restart. To keep it installed, it has to be signed by
Mozilla (see Known gaps). Two differences from Chrome: the confirmation
for risky clicks is a notification you **click to allow** (ignore it to
deny), and `evaluate` runs only on sites that allow running code.

**Then, in either browser:** open the extension's **Options** page and fill in:

| Field | Value |
|---|---|
| Relay URL | `ws://localhost:3000/ws` (note `ws://` and `/ws`) |
| Puller token | the `PULLER_TOKEN` value from `.env` |
| Browser id | a short name for this browser, e.g. `office` |
| Tags | optional, comma-separated, e.g. `work` |

**Check:** click the extension's toolbar icon. The dot is green and it
says *connected*. If it isn't, the error under it says why. Usually the
relay isn't running, or the token doesn't match.

The same window lists what the extension is doing: what's running now,
recent commands with ✓/✗, and a kill switch.

### 5. Register the MCP with Claude Code (user-scope)

So the browser tools load in **every** Claude Code session — not just
when you launch from this project directory — register at user scope.
The recommended setup points Node at the project's `.env` via an
absolute path, so you can rotate tokens by editing one file without
re-registering anything:

```bash
claude mcp add browser-bridge -s user -- \
  node --env-file-if-exists=$HOME/tools/rx-browser-bridge-mcp/.env \
       $HOME/tools/rx-browser-bridge-mcp/mcp/dist/server.js
```

What this does:

- `-s user` writes the registration into your user config
  (`~/.claude.json`), so it loads regardless of CWD.
- `--env-file-if-exists=…/.env` tells Node to load env vars from that
  absolute path on every launch — `POSTER_TOKEN`, `RELAY_URL`, and the
  optional `DEFAULT_TARGET` come from there.
- The trailing `--` separates Claude's flags from the command to spawn.

#### Alternative — env vars baked into the registration

If you'd rather not depend on `.env` (e.g. you want the token in a
secret manager and pulled in at register-time), pass the values
directly with `-e`:

```bash
claude mcp add browser-bridge -s user \
  -e POSTER_TOKEN=your-token-here \
  -e RELAY_URL=http://localhost:3000 \
  -- node $HOME/tools/rx-browser-bridge-mcp/mcp/dist/server.js
```

The downside: you re-run `claude mcp add` every time you rotate.

#### Verify

```bash
claude mcp list             # should show 'browser-bridge'
claude                      # launch from any directory
> list_browsers             # should return the browser you registered
> navigate https://reddit.com on browser "office"
> screenshot
```

#### Other MCP clients

The MCP server is a vanilla `@modelcontextprotocol/sdk` stdio server.
Any MCP-aware client works — point it at
`node /abs/path/to/mcp/dist/server.js` with `POSTER_TOKEN` and
`RELAY_URL` in the env. Common locations:

- **Cursor** — `~/.cursor/mcp.json`
- **Cline** — settings panel → MCP servers
- **Zed**, **Continue**, **Goose**, **Windsurf** — see each client's
  MCP-server docs.

## Quick start (project-local, for development)

If you're hacking on the MCP itself and don't want a user-scope
registration, the repo ships a project-local `.mcp.json` that wires
things up when Claude is launched from this directory:

```bash
cd rx-browser-bridge-mcp
claude --mcp-config ./.mcp.json
```

Same relay / extension setup as steps 3–4 above. Plugin / marketplace
packaging is TBD — see Roadmap.

## Tests

```bash
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

Spawns a relay on port 3399, launches headless Chromium with the
unpacked extension, registers the browser, exercises the full pipe.

## Command set (current)

| Tool | Args | Destructive? |
|---|---|---|
| `list_browsers` | — | no |
| `list_tabs` | `target?` / `tag?` | no |
| `focus_tab` | `tabId?`, `target?` / `tag?` | no (changes what's on screen) |
| `screenshot` | `fullPage?`, `tabId?`, `target?` / `tag?` | no |
| `navigate` | `url`, `tabId?`, `target?` / `tag?` | no |
| `new_tab` | `url`, `active?`, `target?` / `tag?` | no |
| `click` | `selector`, `tabId?`, `target?` / `tag?` | yes if selector matches submit/post/send |
| `fill` | `selector`, `value`, `tabId?`, `target?` / `tag?` | yes if selector mentions password |
| `query` | `selector`, `tabId?`, `target?` / `tag?` | no |
| `evaluate` | `code`, `tabId?`, `target?` / `tag?` | runs arbitrary JS — see note |

If a page doesn't answer within 25s, the call fails with
`tab-unresponsive` and the tab's state, instead of hanging. Usual cause:
Chrome paused a background tab, or the page waits on an alert/confirm.
`focus_tab` brings the tab forward, which wakes it.

`evaluate` runs arbitrary JavaScript in the active tab and returns the
final expression value (JSON-encoded; return a Promise to await async
work). It's the escape hatch for anything `click`/`fill`/`query` can't
express. It is **not** behind the confirmation prompt — it relies on the
toolbar activity flash + the audit log for visibility, so the agent can
chain complex page work without a click per step.

It runs in the extension's **userScripts** world, whose CSP is set to
allow `eval` and which is exempt from the page's own CSP — so it works
even on CSP-locked sites (GitHub, etc.). This requires the **"Allow user
scripts"** toggle on the extension's `chrome://extensions` Details page
(Chrome's mandatory gate for the `userScripts` API). Without it,
`evaluate` falls back to the page's MAIN world, where a CSP forbidding
`unsafe-eval` will block it. Note: the userScripts world shares the DOM
but not the page's JS globals.

`screenshot` captures the visible viewport by default. Pass
`fullPage: true` to capture the entire scrollable page: the extension
scrolls a viewport at a time, captures each step with
`chrome.tabs.captureVisibleTab`, and stitches the slices on an
`OffscreenCanvas` — no `chrome.debugger` / CDP. Caveats: `position:fixed`
/ sticky elements repeat on each slice, lazy content must paint quickly
after each scroll, and very long pages are capped (12 slices) to stay
within the relay's poll budget.

Destructive actions trigger a Chrome notification with Allow / Deny
buttons (10s timeout = deny). Per-domain / per-action trust toggles
NOT yet implemented.

## Targeting

**Which browser** (every tool):
- `target: "office"` — exact browser id, errors if not online.
- `tag: "reddit"` — first online browser carrying the tag.
- No multicast/broadcast (intentional POC scope).

**Which tab** (`screenshot`/`navigate`/`click`/`fill`/`query`/`evaluate`):
- Omit `tabId` → the active tab of the **last-focused window**, skipping
  the extension's own pages and `chrome://` (so it never lands on the
  popup/options).
- `tabId: N` → that exact tab. Get ids from `list_tabs` (or `new_tab`'s
  return). DOM actions hit a background tab without disturbing focus;
  `screenshot` briefly activates the tab first, since only a window's
  visible tab can be captured.
- With multiple windows, "active tab" is just whatever window you focused
  last — so for deterministic targeting, look the tab up with `list_tabs`
  and pass its `tabId`.
- Every action echoes the resolved `tab_id` (and `list_tabs` flags the
  current tab via `current: true` / `current_tab_id`), so once a tab is
  referenced — even "the current tab" — its id can be captured and reused
  as `tabId` to keep follow-up actions pinned to it across turns.

## Security model (POC-level)

- Two-token split: POSTER (CC writes), PULLER (extension reads). One
  leak doesn't grant both directions.
- Tokens via env var. **Rotate the defaults** before exposing publicly.
- Relay binds to `127.0.0.1` by default. Cross-network deploy: front
  with TLS (Caddy / Cloudflare Tunnel / Tailscale Funnel — out of POC
  scope).
- Extension `host_permissions: ["<all_urls>"]` for the walking
  skeleton — tighten to per-domain allowlist for production.
- Audit log captures every register / cmd / result with timestamps.
  Inspect: `sqlite3 relay/data/relay.sqlite "select * from audit order by id desc limit 50"`.

## Known POC gaps

- Single-target only; no broadcast / multicast.
- No TLS layer (relay is plain HTTP + WS).
- No per-domain confirmation policy (only the heuristic match on
  selector text).
- No retry/backpressure on flood-enqueue.
- MCP plugin not published to a marketplace yet.
- Firefox: loads only as a temporary add-on (not signed by Mozilla yet).

## Roadmap

- Plugin packaging (`.claude-plugin/`) so users can `claude plugin
  install rx-browser-bridge@arikw`.
- TLS sidecar (Caddy compose service).
- Per-domain confirmation policy + "trust for 10min" toggle.
- Cross-network deploy guide (Tailscale / Cloudflare Tunnel).
- Tab targeting (URL match, window selector).

## License

MIT.
