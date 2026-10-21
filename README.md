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
