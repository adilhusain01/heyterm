// Installs nothing itself: run it after `npm install -g <packed tarball>`. Starts the installed
// callsign in a throwaway home, checks it answers and guards its sockets, stops it, uninstalls it,
// and checks nothing is left running or behind. Exits non-zero on the first failure.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const port = "4999";
const home = mkdtempSync(path.join(os.tmpdir(), "callsign-smoke-"));
const dataDirectory = path.join(home, ".callsign");
const claudeSettingsPath = path.join(home, "claude-settings.json");
writeFileSync(claudeSettingsPath, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "my-own-hook" }] }] } }));
writeFileSync(path.join(home, "config.json"), "{}");
const environment = { ...process.env, CALLSIGN_PORT: port, CALLSIGN_DATA_DIRECTORY: dataDirectory, CALLSIGN_CLAUDE_SETTINGS_PATH: claudeSettingsPath, CALLSIGN_PROJECT_ROOTS: home };
const shell = process.platform === "win32";

function callsign(args) {
  const result = spawnSync("callsign", args, { env: environment, encoding: "utf8", shell, timeout: 60_000 });
  console.log(`$ callsign ${args.join(" ")}\n${result.stdout}${result.stderr}`);
  return result;
}

function fail(message) {
  console.error(`SMOKE FAILED: ${message}`);
  process.exit(1);
}

async function health() {
  return fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_000) })
    .then((response) => response.json())
    .catch(() => undefined);
}

async function waitFor(check, what) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`timed out waiting for ${what}`);
}

if (callsign(["doctor"]).status !== 0) fail("doctor reported a problem");

const server = spawn("callsign", ["--no-open"], { env: environment, shell, stdio: "inherit" });
await waitFor(async () => (await health())?.app === "callsign", "Callsign to answer");

const refused = await new Promise((resolve) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  socket.onopen = () => resolve(false);
  socket.onerror = () => resolve(true);
});
if (!refused) fail("a page without the token was let in");

const token = readFileSync(path.join(dataDirectory, "token"), "utf8").trim();
const snapshot = await new Promise((resolve) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
  socket.onmessage = (event) => resolve(JSON.parse(String(event.data)).type);
  socket.onerror = () => resolve(undefined);
});
if (snapshot !== "snapshot") fail("a page with the token was not let in");

if (callsign(["stop"]).status !== 0) fail("stop failed");
await waitFor(async () => (await health()) === undefined, "Callsign to stop");
await Promise.race([new Promise((resolve) => server.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5_000))]);

if (callsign(["uninstall"]).status !== 0) fail("uninstall failed");
const settings = JSON.parse(readFileSync(claudeSettingsPath, "utf8"));
if (JSON.stringify(settings) !== JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "my-own-hook" }] }] } })) fail("the user's own Claude settings changed");
if (existsSync(dataDirectory)) console.log(`Note: ${dataDirectory} is still there (no Trash on this system); uninstall said so.`);
console.log("SMOKE PASSED");
process.exit(0);
