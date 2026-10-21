# mcp-hub

Run MCP servers **once** and share them across every Claude session and project, instead of one copy per session.

Built on [`@1mcp/agent`](https://www.npmjs.com/package/@1mcp/agent) (version pinned in `package.json`).
Tested: 4 client sessions -> still 1 backend process; a real tool call works.

## Why

By default each Claude session starts its own copy of every stdio MCP server (RAM x number of sessions).
With the hub, the servers run once and each session connects to `http://127.0.0.1:8800/mcp`.

> `supergateway` was tested and does NOT share: it spawns one child per session. Do not use it for this.

## Requirements

Node.js 18+ and npm. Nothing else (no Docker).

## Where 1mcp is installed

1mcp (`@1mcp/agent`) is a **local dependency** of this folder, not a global tool:

| Item | Location |
|---|---|
| Package (pinned `0.39.3`) | `D:\TienNHM\mcp-hub\node_modules\@1mcp\agent` |
| CLI | run from this folder: `npx --no-install 1mcp <command>` (verified) |
| Runtime data (pid, log, sessions, generated config) | `D:\TienNHM\mcp-hub\.run\` |

Install / upgrade:

```bash
npm install                      # installs the pinned version
# upgrade: edit the version in package.json, then
npm install && node hub.mjs restart
```

Optional, to type `1mcp ...` from any folder: `npm install -g @1mcp/agent@0.39.3`
(not needed for the hub; the global CLI would not know this hub's `.run` folder unless you pass `-d`/`-c`).

Useful CLI checks (run in this folder; `-d`/`-c` point the CLI at this hub's data):

```bash
npx --no-install 1mcp serve --status -d D:/TienNHM/mcp-hub/.run/agent -c D:/TienNHM/mcp-hub/.run/mcp.json
npx --no-install 1mcp --help      # all commands: mcp, preset, inspect, run, admin, ...
```

## Quick start

```bash
cd D:\TienNHM\mcp-hub
npm install                  # first time only (start also does it automatically)
node hub.mjs start           # runs in the background
node hub.mjs status          # running | port 8800 open
node hub.mjs connect         # prints the command that registers the hub in Claude
```

Run the printed command once (user scope = all projects):

```bash
claude mcp add --transport http --scope user hub http://127.0.0.1:8800/mcp
```

Or only for one project, in its `.mcp.json`:

```json
{ "mcpServers": { "hub": { "type": "http", "url": "http://127.0.0.1:8800/mcp" } } }
```

Then open a new Claude session. Check with `/mcp`: `hub` should be connected.
(If `claude mcp add` syntax differs on your version, see `claude mcp add --help`.)

## Commands

| Command | What it does |
|---|---|
| `node hub.mjs start` | Start in background (no-op if already running) |
| `node hub.mjs stop` | Stop the hub and all its servers |
| `node hub.mjs restart` | Stop + start. **Required after editing `mcp-hub.json`** or after `az login` changes |
| `node hub.mjs status` | pid, port state, server list, url, log path |
| `node hub.mjs connect` | Print the `claude mcp add` command |
| `node hub.mjs autostart-on` | Start at Windows logon (Task Scheduler task `McpHub`) |
| `node hub.mjs autostart-off` | Remove that task |

## Admin web UI

URL: **http://127.0.0.1:8800/admin** (`/` redirects there). The page title is "1MCP Admin Console".
The hub must be running (`node hub.mjs status`).

### First time: create the admin account (required once)

The UI is locked until an admin account exists. Opening `/admin` first shows
**"Setup required - NO ADMIN ACCOUNT"** and a `1mcp admin bootstrap ...` command.
The browser cannot create the account; do it in a terminal on this machine:

```bash
cd D:\TienNHM\mcp-hub
npx --no-install 1mcp admin bootstrap -d D:/TienNHM/mcp-hub/.run/agent -c D:/TienNHM/mcp-hub/.run/mcp.json --username <your-name> --password '<long-random-password>'
```

- **Do not run the bare command shown on the page** (`1mcp admin bootstrap --username ...`). Without `-d`/`-c` it creates the
  account in `%APPDATA%\1mcp`, not in this hub's data folder (`.run`), and `/admin` keeps showing "NO ADMIN ACCOUNT".
  (Seen in practice. Fix: re-run with the flags above; the stray `%APPDATA%\1mcp` folder can be deleted.)
- `operator` / `use-a-long-random-password` on the page are only examples. Choose your own and keep the password in a password manager.
- Then refresh `/admin` and sign in. If bootstrap says it cannot find the runtime, check `-d`/`-c` match the `serve --status` command above.

Related CLI (same flags): `1mcp admin login | status | logout` (CLI sessions; `--context local` is required for these).

### Sign in / out

Open `/admin`, enter the username and password you chose in bootstrap, press **Log in**.
After login the top bar shows `Runtime online`, the version and your username; the icon at the far right is **log out**.
The session is per browser (logging in with Chrome does not log in other browsers).

### Page tour (left menu)

Everything below was checked by opening each page; only reading was done, nothing was changed.

| Menu | URL | What you see / use it for |
|---|---|---|
| **Overview** | `/admin` | Health summary. Counters: Enabled servers, Disabled servers, OAuth attention, Failed audits. "Needs attention" lists problems (or "No action required"). "Runtime identity": version, external URL, runtime scope id (each with a Copy button). First place to look when something is wrong. |
| **Server inventory** | `/admin/servers` | Table of servers in the hub: name, status (ENABLED), transport/command (secrets are masked, e.g. `--authentication REDACTED`), number of secrets, and a toggle to enable/disable. Filters: All / Enabled / Disabled and Static / Template, plus a search box. Buttons: pencil (edit a server), **Configure Custom Server** (add one). |
| **Presets** | `/admin/presets` | Presets = named filters that expose only some servers, chosen by **tags**. Create with a name (letters, numbers, `-`, `_`, max 50) and tag rules (match any / match all, include / exclude); "Preview matches" shows which servers would match before saving. Only useful once servers have tags. Empty for now. |
| **Instructions** | `/admin/instructions` | Instruction templates sent to new clients (an "Initialization" text and a "CLI" text). Built-in `default` is active. You can draft your own, validate, preview and activate it. Safe to ignore. |
| **OAuth services** | `/admin/oauth` | OAuth state per server. `azure-devops` shows **CONNECTED / No OAuth action required** (it uses `az login`, not OAuth). Relevant only for servers that need a browser OAuth sign-in. |
| **Audit trail** | `/admin/audit` | Redacted log of admin actions done through the UI. Empty until someone changes something. |
| **Backend logs** | `/admin/logs` | Live stderr of each managed server (here `azure-devops`: its start line shows the org and enabled domains). Use it to see why a server did not start. |
| **About** | `/admin/about` | Versions (runtime and UI `0.39.3`), runtime scope id, external URL, links to the project. |

### Daily use

- Check the hub is healthy: Overview shows **Runtime online** and `Enabled servers = N`.
- A tool is missing in Claude: Server inventory (is it ENABLED?) then Backend logs (why did it fail?).
- Temporarily turn a server off: toggle in Server inventory.
- **Permanent changes: edit `mcp-hub.json`.** `node hub.mjs start` regenerates `.run/mcp.json` from `mcp-hub.json`,
  so a server added or changed only in the UI can be overwritten by the next `start`.

Important: the admin account protects the **UI only**. The MCP endpoint `http://127.0.0.1:8800/mcp` still has no authentication.

## Configure servers

Edit `mcp-hub.json`. `mcpServers` has the same shape as a normal `.mcp.json`:

```json
{
  "port": 8800,
  "host": "127.0.0.1",
  "mcpServers": {
    "azure-devops": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@azure-devops/mcp", "<org>", "--authentication", "azcli", "-d", "core", "work-items"],
      "env": { "ado_mcp_project": "<project>" }
    },
    "my-node-server": { "command": "node", "args": ["C:/path/to/server.js"] }
  }
}
```

- On Windows wrap `npx` as `"command": "cmd", "args": ["/c", "npx", ...]` (verified working).
- Then `node hub.mjs restart`.

## Use in another project

- Same machine, same servers: just run the `claude mcp add --scope user` command once, all projects see the hub.
- Different servers per project: copy this folder (or keep it and set a second config + port):

  ```bash
  MCP_HUB_CONFIG=D:\other\mcp-hub.json node hub.mjs start     # that file must use a different "port"
  ```
  Note: pid/log files live in this folder's `.run/`, so a second instance needs its own copy of the folder.

## Tool names change

Through the hub a tool is named `mcp__<client-name>__<server>_1mcp_<tool>`, for example:

`azure-devops` tool `core_list_projects` -> `mcp__hub__azure-devops_1mcp_core_list_projects`

Rules, skills, hooks and permission allow-lists that mention the old names (`mcp__azure-devops__*`) must be updated.

## Switching an existing setup (checklist)

1. `node hub.mjs start` and `status` shows `open`.
2. Register the hub (command above).
3. Remove the old per-session entries of the servers now in the hub (user `~/.claude.json` and project `.mcp.json`),
   otherwise you still pay for the duplicate copies.
4. Update old tool names in rules/skills/allow-lists.
5. New session -> `/mcp` -> call one tool to confirm.

## Good for / not good for

| Good | Not good |
|---|---|
| Stateless API-style servers (Azure DevOps, GitKraken, docs, search) | Servers with per-session state (browser control such as chrome-devtools, evidence/recorder servers) |

Keep stateful servers as normal per-session entries. Sharing them can mix data between sessions.

## Security

- Binds to `127.0.0.1` only. There is **no authentication**: any local process can call the servers using their credentials.
- All sessions share ONE identity (for Azure DevOps with `azcli`: the account of `az login` for the user that started the hub).
  After `az login`/token renewal run `restart`.
- Do not change `host` to `0.0.0.0`.
- Do not put secrets in this repo; `mcp-hub.json` is committed. Use env vars set in the shell that starts the hub.

## Troubleshooting

| Problem | Check |
|---|---|
| `failed to start` | `.run/hub.log`. Usually port in use -> change `port` |
| `/mcp` shows hub failed | `node hub.mjs status`; start it. Hub is not running after reboot unless `autostart-on` |
| Server tools missing | Server crashed on start: read `.run/hub.log` (bad path, not logged in) |
| Auth errors (401/expired) | Re-login (`az login`), then `node hub.mjs restart` |
| Changed `mcp-hub.json` but nothing changed | Run `restart` |
| Port check | `Get-NetTCPConnection -LocalPort 8800 -State Listen` |
| Still too much RAM | `claude.exe` itself is the big one; close unused sessions |

## Files

| File | Purpose |
|---|---|
| `hub.mjs` | The CLI (start/stop/status/...). No dependencies of its own |
| `mcp-hub.json` | Port + servers (edit this) |
| `package.json` | Pins `@1mcp/agent` |
| `.run/` | pid, log, generated config (git-ignored) |

## Uninstall

```bash
node hub.mjs autostart-off
node hub.mjs stop
claude mcp remove hub
```
Then restore the old per-session entries if you want them back.
