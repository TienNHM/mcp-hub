#!/usr/bin/env node
// mcp-hub: one shared process for MCP servers (backed by @1mcp/agent). Zero deps of its own.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RUN = join(ROOT, '.run');
const PID_FILE = join(RUN, 'hub.pid');
const LOG_FILE = join(RUN, 'hub.log');
const AGENT = join(ROOT, 'node_modules', '@1mcp', 'agent', 'build', 'index.js');
const CONFIG = resolve(process.env.MCP_HUB_CONFIG ?? join(ROOT, 'mcp-hub.json'));

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const host = cfg.host ?? '127.0.0.1';
const port = cfg.port ?? 8800;
const url = `http://${host}:${port}/mcp`;

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const readPid = () => (existsSync(PID_FILE) ? Number(readFileSync(PID_FILE, 'utf8')) : 0);
const listening = () => new Promise((ok) => {
  const s = net.connect({ host, port }).once('connect', () => { s.destroy(); ok(true); }).once('error', () => ok(false));
});

async function start() {
  const pid = readPid();
  if (pid && alive(pid)) return console.log(`already running (pid ${pid}) -> ${url}`);
  if (!existsSync(AGENT)) {
    console.log('installing dependencies...');
    if (spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: true }).status) process.exit(1);
  }
  mkdirSync(join(RUN, 'agent'), { recursive: true });
  const runCfg = join(RUN, 'mcp.json');
  writeFileSync(runCfg, JSON.stringify({ mcpServers: cfg.mcpServers }, null, 2));
  const log = openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [AGENT, 'serve', '--config', runCfg, '--config-dir', join(RUN, 'agent'),
    '--transport', 'http', '--host', host, '--port', String(port)],
  { detached: true, stdio: ['ignore', log, log], windowsHide: true });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  for (let i = 0; i < 60; i++) {
    if (await listening()) return console.log(`started (pid ${child.pid}) -> ${url}`);
    if (!alive(child.pid)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`failed to start, see ${LOG_FILE}`);
  process.exit(1);
}

function stop() {
  const pid = readPid();
  if (!pid || !alive(pid)) { rmSync(PID_FILE, { force: true }); return console.log('not running'); }
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else process.kill(-pid);
  rmSync(PID_FILE, { force: true });
  console.log(`stopped (pid ${pid})`);
}

async function status() {
  const pid = readPid();
  const up = pid && alive(pid);
  console.log(`${up ? 'running' : 'stopped'}${up ? ` (pid ${pid})` : ''} | port ${port} ${(await listening()) ? 'open' : 'closed'}`);
  console.log(`servers: ${Object.keys(cfg.mcpServers).join(', ')}\nurl: ${url}\nlog: ${LOG_FILE}`);
}

function autostart(on) {
  if (process.platform !== 'win32') return console.log('autostart is Windows-only (Task Scheduler)');
  const args = on
    ? ['/Create', '/F', '/SC', 'ONLOGON', '/TN', 'McpHub', '/TR', `"${process.execPath}" "${join(ROOT, 'hub.mjs')}" start`]
    : ['/Delete', '/F', '/TN', 'McpHub'];
  process.exitCode = spawnSync('schtasks', args, { stdio: 'inherit' }).status ?? 1;
}

const cmds = {
  start, stop, status,
  restart: async () => { stop(); await start(); },
  connect: () => console.log(`claude mcp add --transport http --scope user hub ${url}`),
  'autostart-on': () => autostart(true),
  'autostart-off': () => autostart(false),
};
const run = cmds[process.argv[2]];
if (!run) { console.log(`usage: node hub.mjs <${Object.keys(cmds).join('|')}>`); process.exit(1); }
await run();
