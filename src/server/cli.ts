// The `heyterm` command: start it and open it, stop it, check this computer, or remove everything
// it put here.

import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { AgentAdapters } from "./agents/agent-adapters.ts";
import { CliArguments } from "./cli-arguments.ts";
import { agentHookPaths } from "./hooks/agent-hook-files.ts";
import { claudeUserSettingsPath } from "./hooks/existing-session-connector.ts";
import { ProcessChannel } from "./keeper/keeper-channel.ts";
import { KeptTerminals } from "./keeper/kept-terminals.ts";
import { TerminalKeeper } from "./keeper/terminal-keeper.ts";
import { startHeyTerm } from "./main.ts";
import { DataFolder } from "./setup/data-folder.ts";
import { RemotesFile } from "./remote/remotes-file.ts";
import { compareVersions, testedClaudeVersion } from "./setup/setup-service.ts";
import { moveToTrash } from "./setup/trash.ts";
import { Uninstaller } from "./setup/uninstaller.ts";

const execFileAsync = promisify(execFile);

const helpText = `HeyTerm: run your coding agents by voice.

Usage:
  heyterm              start HeyTerm and open it (opens the running one if it is already up)
  heyterm stop         stop HeyTerm and every session in it
  heyterm restart      restart HeyTerm; its sessions keep running
  heyterm doctor       check that this computer has what HeyTerm needs
  heyterm uninstall    stop it and remove everything it put on this computer
  heyterm remote add <name> <address>
                       show another computer's HeyTerm sessions here as <name>/...;
                       pass its token on standard input, for example:
                       ssh vps cat ~/.heyterm/token | heyterm remote add vps https://vps.example.ts.net:8443
  heyterm remote list | remote remove <name>
  heyterm --remote-host --allow-host <name>
                       serve another computer's HeyTerm (on a VPS): keeps running with no page,
                       and accepts requests that name <name>, such as its Tailscale name
  heyterm --no-open    start without opening the browser
  heyterm --port 4747  use another port (or set HEYTERM_PORT)
  heyterm --help       show this text
`;

async function runCli(args: string[]): Promise<void> {
  const { command, commandArguments, port, open, help, remoteHost, acceptedHostNames } = CliArguments.parse(args);
  if (help) return void process.stdout.write(helpText);
  if (port) process.env.HEYTERM_PORT = port;
  if (remoteHost) process.env.HEYTERM_REMOTE_HOST = "1";
  if (acceptedHostNames.length > 0) process.env.HEYTERM_ACCEPTED_HOSTS = acceptedHostNames.join(",");
  if (command === "remote") process.exit((await runRemoteCommand(commandArguments)) ? 0 : 1);
  if (command === "doctor") process.exit((await runDoctor()) ? 0 : 1);
  if (command === "stop") process.exit((await stopRunning()) ? 0 : 1);
  if (command === "restart") process.exit((await restartRunning()) ? 0 : 1);
  if (command === "uninstall") process.exit((await uninstall()) ? 0 : 1);
  if (command) {
    console.error(`Unknown command: ${command}\n`);
    process.stdout.write(helpText);
    process.exit(1);
  }

  if (process.env.HEYTERM_SERVER_CHILD === "1") return runServerChild();
  if (await isRunning()) {
    console.log(`HeyTerm is already running at ${baseUrl()}. Opening it.`);
    if (open) openInBrowser(await pageUrl());
    return;
  }
  if (runningKeeperId()) {
    console.log("HeyTerm's server is starting again and its sessions are still running. Try again in a few seconds, or run heyterm stop.");
    process.exit(1);
  }
  if (!(await runDoctor({ quietWhenHealthy: true }))) process.exit(1);
  // Without the keeper (HEYTERM_NO_KEEPER=1) the terminals live in the server and end with it.
  if (process.env.HEYTERM_NO_KEEPER === "1") {
    try {
      const running = await startHeyTerm();
      if (open) openInBrowser(`${running.url}/#ticket=${running.issueTicket()}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
    return;
  }
  await DataFolder.ensurePrivate(dataDirectory());
  new TerminalKeeper({ entryScript: TerminalKeeper.serverEntryScript(process.argv[1]!), serverBundle: fileURLToPath(import.meta.url), pidFile: keeperPidFile(), openPageOnFirstStart: open }).start();
}

// The server, run by the terminal keeper: it takes over the terminals that outlived the last one.
async function runServerChild(): Promise<void> {
  const channel = ProcessChannel.toKeeper();
  const terminals = new KeptTerminals(channel);
  const runningTerminalNames = await terminals.ready;
  try {
    const running = await startHeyTerm({ terminals, runningTerminalNames });
    terminals.announceListening();
    // Without its keeper the terminals are gone as well, so this server has nothing left to run.
    channel.onClose(() => void running.stop("its terminal keeper ended").then(() => process.exit(0)));
    if (process.env.HEYTERM_OPEN_PAGE === "1") openInBrowser(`${running.url}/#ticket=${running.issueTicket()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Prints one line per check, with the fix for anything missing. Returns false when HeyTerm cannot run.
async function runDoctor(options: { quietWhenHealthy?: boolean } = {}): Promise<boolean> {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const agents = await Promise.all(AgentAdapters.all().map(async (adapter) => ({ adapter, version: await versionOf(adapter.program) })));
  const hasAnAgent = agents.some((agent) => agent.version);
  // HeyTerm starts without an agent too: its Setup screen says what to install.
  const healthy = nodeMajor >= 20;
  if (healthy && options.quietWhenHealthy) return true;
  console.log(`${nodeMajor >= 20 ? "ok " : "!! "} ${"Node.js".padEnd(12)} ${process.versions.node}${nodeMajor >= 20 ? "" : "\n    Install Node.js 20 or newer from nodejs.org."}`);
  for (const { adapter, version } of agents) {
    console.log(`${version ? "ok " : "-  "} ${adapter.label.padEnd(12)} ${version ?? "not installed"}${version ? "" : `\n    ${adapter.installHint}`}`);
  }
  const claude = agents.find((agent) => agent.adapter.kind === "claude")?.version;
  if (claude && compareVersions(claude, testedClaudeVersion) < 0) console.log(`    HeyTerm was checked against Claude Code ${testedClaudeVersion}. Run: claude update`);
  if (!hasAnAgent) console.log("\nInstall at least one coding agent above. The assistant also needs Claude Code.");
  console.log(healthy ? "\nReady. Run heyterm to start." : "\nFix the lines marked !! and run heyterm doctor again.");
  return healthy;
}

async function stopRunning(): Promise<boolean> {
  if (!(await isRunning())) {
    // The server is down but its keeper still holds terminals: the keeper is stopped, and they end.
    const keeperId = runningKeeperId();
    if (keeperId) {
      process.kill(keeperId, "SIGTERM");
      for (let attempt = 0; attempt < 100 && runningKeeperId(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 200));
      console.log("HeyTerm stopped.");
      return true;
    }
    console.log("HeyTerm is not running.");
    return true;
  }
  const token = await readToken();
  const response = await fetch(`${baseUrl()}/shutdown`, { method: "POST", headers: { "X-HeyTerm-Token": token ?? "", "X-Callsign-Token": token ?? "" } }).catch(() => undefined);
  if (!response?.ok) {
    console.error("HeyTerm did not accept the stop request. Press Ctrl+C in the terminal where it runs.");
    return false;
  }
  for (let attempt = 0; attempt < 50 && (await isRunning()); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 200));
  console.log("HeyTerm stopped.");
  return true;
}

async function restartRunning(): Promise<boolean> {
  if (!(await isRunning())) {
    console.log("HeyTerm is not running. Start it with heyterm.");
    return false;
  }
  const token = await readToken();
  const response = await fetch(`${baseUrl()}/restart`, { method: "POST", headers: { "X-HeyTerm-Token": token ?? "" } }).catch(() => undefined);
  if (!response?.ok) {
    console.error(response ? await response.text() : "HeyTerm did not answer the restart request.");
    return false;
  }
  for (let attempt = 0; attempt < 50 && (await isRunning()); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 200));
  for (let attempt = 0; attempt < 150 && !(await isRunning()); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 200));
  if (!(await isRunning())) {
    console.error("HeyTerm has not come back yet. Its sessions are still running; check the terminal it runs in.");
    return false;
  }
  console.log("HeyTerm restarted. Its sessions kept running.");
  return true;
}

async function uninstall(): Promise<boolean> {
  if (!(await stopRunning())) return false;
  const report = await new Uninstaller({ dataDirectory: dataDirectory(), claudeSettingsPath: claudeUserSettingsPath(), moveToTrash, agentHookPaths: agentHookPaths() }).run();
  console.log(report.removedHooks ? "Took HeyTerm's hooks out of your Claude Code settings." : "Your Claude Code settings had no HeyTerm hooks.");
  for (const folder of report.trashed) console.log(`Moved ${folder} to the Trash.`);
  for (const folder of report.leftBehind) console.log(`Could not move ${folder} to the Trash. Delete it yourself if you want it gone.`);
  console.log("\nLast step, to remove the heyterm command itself:\n  npm uninstall -g heyterm");
  return true;
}

async function isRunning(): Promise<boolean> {
  const response = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(1_500) }).catch(() => undefined);
  if (!response?.ok) return false;
  const body = (await response.json().catch(() => ({}))) as { app?: string };
  // "callsign" is the same program under its old name, still running from before the rename.
  return body.app === "heyterm" || body.app === "callsign";
}

// The running copy hands out a one-time ticket to whoever holds the token; the token stays out of the address.
async function pageUrl(): Promise<string> {
  const token = await readToken();
  const response = token ? await fetch(`${baseUrl()}/ticket`, { method: "POST", headers: { "X-HeyTerm-Token": token } }).catch(() => undefined) : undefined;
  const body = response?.ok ? ((await response.json().catch(() => ({}))) as { ticket?: string }) : {};
  if (body.ticket) return `${baseUrl()}/#ticket=${body.ticket}`;
  // A copy started before tickets existed still takes the token in the address.
  return token ? `${baseUrl()}/#token=${token}` : baseUrl();
}

function baseUrl(): string {
  return `http://127.0.0.1:${process.env.HEYTERM_PORT ?? 4747}`;
}

// heyterm remote add|list|remove. The token comes on standard input so it is never typed into a
// command line or shown on screen.
async function runRemoteCommand(commandArguments: string[]): Promise<boolean> {
  const remotes = new RemotesFile(dataDirectory());
  const [action, name, address] = commandArguments;
  if (action === "list") {
    const known = await remotes.list();
    if (known.length === 0) console.log("No other computers yet. Add one with heyterm remote add <name> <address>.");
    for (const remote of known) console.log(`${remote.name}  ${remote.url}`);
    return true;
  }
  if (action === "remove" && name) {
    const removed = await remotes.remove(name);
    console.log(removed ? `Removed ${name}. Restart HeyTerm to stop showing its sessions.` : `There is no computer called ${name}.`);
    return removed;
  }
  if (action === "add" && name && address) {
    if (process.stdin.isTTY) {
      console.error(`Pass ${name}'s HeyTerm token on standard input, for example:\n  ssh ${name} cat ~/.heyterm/token | heyterm remote add ${name} ${address}`);
      return false;
    }
    const token = (await readStandardInput()).trim();
    const problem = await remotes.add({ name, url: address, token });
    if (problem) {
      console.error(problem);
      return false;
    }
    console.log(`Added ${name}. Restart HeyTerm to show its sessions as ${name}/...`);
    return true;
  }
  process.stdout.write(helpText);
  return false;
}

async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function keeperPidFile(): string {
  return path.join(dataDirectory(), "keeper.pid");
}

// The process id of a terminal keeper that is still alive, if there is one.
function runningKeeperId(): number | undefined {
  let processId: number;
  try {
    processId = Number(readFileSync(keeperPidFile(), "utf8").trim());
  } catch {
    return undefined;
  }
  if (!Number.isInteger(processId) || processId <= 0 || processId === process.pid) return undefined;
  try {
    process.kill(processId, 0);
    return processId;
  } catch {
    return undefined;
  }
}

function dataDirectory(): string {
  return process.env.HEYTERM_DATA_DIRECTORY ?? path.join(os.homedir(), ".heyterm");
}

async function readToken(): Promise<string | undefined> {
  // A copy started before the rename keeps its token in ~/.callsign until it stops.
  const folders = [dataDirectory(), path.join(os.homedir(), ".callsign")];
  for (const folder of folders) {
    const token = (await readFile(path.join(folder, "token"), "utf8").catch(() => "")).trim();
    if (token) return token;
  }
  return undefined;
}

async function versionOf(program: string): Promise<string | undefined> {
  const output = await execFileAsync(program, ["--version"], { timeout: 10_000, shell: process.platform === "win32" }).then(
    ({ stdout }) => stdout,
    () => "",
  );
  return /(\d+\.\d+(?:\.\d+)?)/.exec(output)?.[1];
}

function openInBrowser(url: string): void {
  const [opener, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd.exe", ["/c", "start", '""', url]] : ["xdg-open", [url]];
  spawn(opener as string, args as string[], { stdio: "ignore", detached: true })
    .on("error", () => console.log(`Open ${url} in your browser.`))
    .unref();
}

await runCli(process.argv.slice(2));
