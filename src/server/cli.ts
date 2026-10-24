// The `callsign` command: start Callsign and open it, or check this computer with `callsign doctor`.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { startCallsign } from "./main.ts";
import { compareVersions, testedClaudeVersion } from "./setup/setup-service.ts";

const execFileAsync = promisify(execFile);

const helpText = `Callsign: run your coding agents by voice.

Usage:
  callsign              start Callsign and open it in your browser
  callsign doctor       check that this computer has what Callsign needs
  callsign --no-open    start without opening the browser
  callsign --port 4747  use another port (or set CALLSIGN_PORT)
  callsign --help       show this text
`;

async function runCli(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) return void process.stdout.write(helpText);
  const portIndex = args.indexOf("--port");
  if (portIndex !== -1 && args[portIndex + 1]) process.env.CALLSIGN_PORT = args[portIndex + 1];
  if (args[0] === "doctor") {
    const healthy = await runDoctor();
    process.exit(healthy ? 0 : 1);
  }
  if (!(await runDoctor({ quietWhenHealthy: true }))) process.exit(1);
  try {
    await startCallsign();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  if (!args.includes("--no-open")) openInBrowser(`http://127.0.0.1:${process.env.CALLSIGN_PORT ?? 4747}`);
}

interface DoctorOptions {
  quietWhenHealthy?: boolean;
}

// Prints one line per check, with the fix for anything missing. Returns false when Callsign cannot run.
async function runDoctor(options: DoctorOptions = {}): Promise<boolean> {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const tmuxVersion = await versionOf("tmux", ["-V"]);
  const claudeVersion = await versionOf("claude", ["--version"]);
  const checks = [
    { name: "Node.js", ok: nodeMajor >= 20, detail: process.versions.node, fix: "Install Node.js 20 or newer from nodejs.org." },
    { name: "tmux", ok: tmuxVersion !== undefined, detail: tmuxVersion ?? "not found", fix: "Install it: brew install tmux (macOS) or sudo apt install tmux (Linux)." },
    { name: "Claude Code", ok: claudeVersion !== undefined, detail: claudeVersion ?? "not found", fix: "Install it from code.claude.com, then sign in once by running claude." },
  ];
  const healthy = checks.every((check) => check.ok);
  if (healthy && options.quietWhenHealthy) return true;
  for (const check of checks) console.log(`${check.ok ? "ok " : "!! "} ${check.name.padEnd(12)} ${check.detail}${check.ok ? "" : `\n    ${check.fix}`}`);
  if (claudeVersion && compareVersions(claudeVersion, testedClaudeVersion) < 0) console.log(`    Callsign was checked against Claude Code ${testedClaudeVersion}. Run: claude update`);
  console.log(healthy ? "\nReady. Run callsign to start." : "\nFix the lines marked !! and run callsign doctor again.");
  return healthy;
}

async function versionOf(command: string, args: string[]): Promise<string | undefined> {
  const output = await execFileAsync(command, args, { timeout: 5_000 }).then(
    ({ stdout }) => stdout,
    () => "",
  );
  return /(\d+\.\d+(?:\.\d+)?)/.exec(output)?.[1];
}

function openInBrowser(url: string): void {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  spawn(opener, [url], { stdio: "ignore", detached: true }).on("error", () => console.log(`Open ${url} in your browser.`)).unref();
}

await runCli(process.argv.slice(2));
