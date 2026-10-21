# mcp-hub

Run MCP servers **once** and share them across every Claude session and project (instead of one copy per session).
Built on [`@1mcp/agent`](https://www.npmjs.com/package/@1mcp/agent) (pinned). Verified: N sessions -> 1 backend process.
`supergateway` does NOT work for this (it spawns one child per session).

## Use

```bash
node hub.mjs start          # background, http://127.0.0.1:8800/mcp
node hub.mjs status
node hub.mjs stop | restart
node hub.mjs connect        # prints the `claude mcp add` command
node hub.mjs autostart-on   # start at Windows logon (Task Scheduler); autostart-off to remove
```

Add servers in `mcp-hub.json` (`mcpServers` = same shape as `.mcp.json`; `port`/`host` optional).
Another project: copy this folder, or `MCP_HUB_CONFIG=<path> node hub.mjs start` with a different `port`.

## Notes

- Tools show up as `mcp__<client-name>__<server>_1mcp_<tool>` (e.g. `mcp__hub__azure-devops_1mcp_core_list_projects`).
  Rules/skills that reference `mcp__azure-devops__*` need the new names.
- Bound to 127.0.0.1, no auth: any local process can use the servers' credentials. Keep it local.
- One shared identity (e.g. `az login` of the user who started the hub).
- Not for per-session/stateful servers (chrome-devtools, ado-evidence).
- Logs: `.run/hub.log`.
