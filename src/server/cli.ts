// The `callsign` command: start it and open it, stop it, check this computer, or remove everything
// it put here.

import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AgentAdapters } from "./agents/agent-adapters.ts";
import { CliArguments } from "./cli-arguments.ts";
import { claudeUserSettingsPath } from "./hooks/existing-session-connector.ts";
import { startCallsign } from "./main.ts";
import { compareVersions, testedClaudeVersion } from "./setup/setup-service.ts";
import { moveToTrash } from "./setup/trash.ts";
import { Uninstaller } from "./setup/uninstaller.ts";

const execFileAsync = promisify(execFile);

const helpText = `Callsign: run your coding agents by voice.

Usage:
  callsign              start Callsign and open it (opens the running one if it is already up)
  callsign stop         stop Callsign and every session in it
  callsign doctor       check that this computer has what Callsign needs
  callsign uninstall    stop it and remove everything it put on this computer
  callsign --no-open    start without opening the browser
  callsign --port 4747  use another port (or set CALLSIGN_PORT)
  callsign --help       show this text
`;

async function runCli(args: string[]): Promise<void> {
  const { command, port, open, help } = CliArguments.parse(args);
  if (help) return void process.stdout.write(helpText);
  if (port) process.env.CALLSIGN_PORT = port;
  if (command === "doctor") process.exit((await runDoctor()) ? 0 : 1);
  if (command === "stop") process.exit((await stopRunning()) ? 0 : 1);
  if (command === "uninstall") process.exit((await uninstall()) ? 0 : 1);
  if (command) {
    console.error(`Unknown command: ${command}\n`);
    process.stdout.write(helpText);
    process.exit(1);
  }

  if (await isRunning()) {
    console.log(`Callsign is already running at ${baseUrl()}. Opening it.`);
    if (open) openInBrowser(await pageUrl());
    return;
  }
  if (!(await runDoctor({ quietWhenHealthy: true }))) process.exit(1);
  try {
    const running = await startCallsign();
    if (open) openInBrowser(`${running.url}/#token=${running.token}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Prints one line per check, with the fix for anything missing. Returns false when Callsign cannot run.
async function runDoctor(options: { quietWhenHealthy?: boolean } = {}): Promise<boolean> {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const agents = await Promise.all(AgentAdapters.all().map(async (adapter) => ({ adapter, version: await versionOf(adapter.program) })));
  const hasAnAgent = agents.some((agent) => agent.version);
  const healthy = nodeMajor >= 20 && hasAnAgent;
  if (healthy && options.quietWhenHealthy) return true;
  console.log(`${nodeMajor >= 20 ? "ok " : "!! "} ${"Node.js".padEnd(12)} ${process.versions.node}${nodeMajor >= 20 ? "" : "\n    Install Node.js 20 or newer from nodejs.org."}`);
  for (const { adapter, version } of agents) {
    console.log(`${version ? "ok " : "-  "} ${adapter.label.padEnd(12)} ${version ?? "not installed"}${version ? "" : `\n    ${adapter.installHint}`}`);
  }
  const claude = agents.find((agent) => agent.adapter.kind === "claude")?.version;
  if (claude && compareVersions(claude, testedClaudeVersion) < 0) console.log(`    Callsign was checked against Claude Code ${testedClaudeVersion}. Run: claude update`);
  if (!hasAnAgent) console.log("\nInstall at least one coding agent above. The assistant also needs Claude Code.");
  console.log(healthy ? "\nReady. Run callsign to start." : "\nFix the lines marked !! and run callsign doctor again.");
  return healthy;
}

async function stopRunning(): Promise<boolean> {
  if (!(await isRunning())) {
    console.log("Callsign is not running.");
    return true;
  }
  const token = await readToken();
  const response = await fetch(`${baseUrl()}/shutdown`, { method: "POST", headers: { "X-Callsign-Token": token ?? "" } }).catch(() => undefined);
  if (!response?.ok) {
    console.error("Callsign did not accept the stop request. Press Ctrl+C in the terminal where it runs.");
    return false;
  }
  for (let attempt = 0; attempt < 50 && (await isRunning()); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 200));
  console.log("Callsign stopped.");
  return true;
}

async function uninstall(): Promise<boolean> {
  if (!(await stopRunning())) return false;
  const report = await new Uninstaller({ dataDirectory: dataDirectory(), claudeSettingsPath: claudeUserSettingsPath(), moveToTrash }).run();
  console.log(report.removedHooks ? "Took Callsign's hooks out of your Claude Code settings." : "Your Claude Code settings had no Callsign hooks.");
  for (const folder of report.trashed) console.log(`Moved ${folder} to the Trash.`);
  for (const folder of report.leftBehind) console.log(`Could not move ${folder} to the Trash. Delete it yourself if you want it gone.`);
  console.log("\nLast step, to remove the callsign command itself:\n  npm uninstall -g callsign-cli");
  return true;
}

async function isRunning(): Promise<boolean> {
  const response = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(1_500) }).catch(() => undefined);
  if (!response?.ok) return false;
  const body = (await response.json().catch(() => ({}))) as { app?: string };
  return body.app === "callsign";
}

async function pageUrl(): Promise<string> {
  const token = await readToken();
  return token ? `${baseUrl()}/#token=${token}` : baseUrl();
}

function baseUrl(): string {
  return `http://127.0.0.1:${process.env.CALLSIGN_PORT ?? 4747}`;
}

function dataDirectory(): string {
  return process.env.CALLSIGN_DATA_DIRECTORY ?? path.join(os.homedir(), ".callsign");
}

async function readToken(): Promise<string | undefined> {
  return (await readFile(path.join(dataDirectory(), "token"), "utf8").catch(() => "")).trim() || undefined;
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
