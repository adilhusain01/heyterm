import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { SuspendRescue, SystemTerminalState, type SuspendRescueSystem, type TerminalState } from "./suspend-rescue.ts";
import { TerminalHost } from "./terminal-host.ts";

const execFileAsync = promisify(execFile);
const posixOnly = process.platform === "win32" ? describe.skip : describe;

// A system that answers with the given terminal states in turn and records what was resumed.
function fakeSystem(states: Array<TerminalState | undefined>): SuspendRescueSystem & { reads: number; resumed: number[] } {
  const system = {
    reads: 0,
    resumed: [] as number[],
    readState: async () => states[Math.min(system.reads++, states.length - 1)],
    resume: (pid: number) => void system.resumed.push(pid),
    wait: async () => undefined,
  };
  return system;
}

const holdsTheTerminal = { leaderPid: 422, isInLineMode: false };
const letGoOfTheTerminal = { leaderPid: 422, isInLineMode: true };

describe("SuspendRescue", () => {
  it("resumes the program leading the terminal once it has let go of the terminal after Ctrl+Z", async () => {
    const system = fakeSystem([holdsTheTerminal, letGoOfTheTerminal, holdsTheTerminal]);
    await new SuspendRescue(system).afterInput("layoutgen", "\x1a");
    expect(system.resumed).toEqual([422]);
  });

  it("resumes again when the first signal came before the program was waiting for it, then stops", async () => {
    const system = fakeSystem([letGoOfTheTerminal, letGoOfTheTerminal, holdsTheTerminal, letGoOfTheTerminal]);
    await new SuspendRescue(system).afterInput("layoutgen", "\x1a");
    expect(system.resumed).toEqual([422, 422]);
    expect(system.reads).toBe(3);
  });

  it("leaves a program alone that keeps the terminal after Ctrl+Z, for which the key means something else", async () => {
    const system = fakeSystem([holdsTheTerminal]);
    await new SuspendRescue(system).afterInput("layoutgen", "\x1a");
    expect(system.resumed).toEqual([]);
  });

  it("does nothing for typing without Ctrl+Z", async () => {
    const system = fakeSystem([letGoOfTheTerminal]);
    await new SuspendRescue(system).afterInput("layoutgen", "fg\r\x1b\x12");
    expect(system.reads).toBe(0);
  });

  it("stops when the terminal cannot be read", async () => {
    const system = fakeSystem([undefined]);
    await new SuspendRescue(system).afterInput("layoutgen", "\x1a");
    expect(system.reads).toBe(1);
    expect(system.resumed).toEqual([]);
  });

  it("watches a session once however often Ctrl+Z is pressed meanwhile", async () => {
    const system = fakeSystem([letGoOfTheTerminal, holdsTheTerminal]);
    const rescue = new SuspendRescue(system);
    await Promise.all([rescue.afterInput("layoutgen", "\x1a"), rescue.afterInput("layoutgen", "\x1a\x1a")]);
    expect(system.resumed).toEqual([422]);
  });
});

describe("SuspendRescue reading ps and stty", () => {
  it("finds the session leader among the programs on a terminal, on macOS and on Linux", () => {
    expect(SuspendRescue.leaderOf("  445 SN+  ttys005\n  422 SNs+ ttys005 \n")).toEqual({ pid: 422, tty: "ttys005" });
    expect(SuspendRescue.leaderOf(" 1240 S+   pts/3\n 1234 Ss+  pts/3\n")).toEqual({ pid: 1234, tty: "pts/3" });
    expect(SuspendRescue.leaderOf(" 1240 S+   pts/3\n")).toBeUndefined();
  });

  it("tells line mode from a program's own mode, in macOS's and Linux's stty output", () => {
    expect(SuspendRescue.isLineMode("lflags: icanon isig iexten echo echoe echok echoke -echonl echoctl")).toBe(true);
    expect(SuspendRescue.isLineMode("lflags: -icanon -isig -iexten -echo echoe echok echoke -echonl echoctl")).toBe(false);
    expect(SuspendRescue.isLineMode("isig icanon iexten echo echoe echok -echonl -noflsh -xcase -tostop")).toBe(true);
    expect(SuspendRescue.isLineMode("-isig -icanon -iexten -echo echoe echok -echonl -noflsh -xcase -tostop")).toBe(false);
  });
});

const hosts: TerminalHost[] = [];

afterEach(() => {
  for (const host of hosts.splice(0)) host.shutdown();
});

async function waitFor(check: () => boolean | Promise<boolean>, milliseconds = 5_000): Promise<void> {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out");
}

// Suspends itself on Ctrl+Z as Claude Code does: hands the terminal back, waits for the signal fg
// sends, then takes the terminal again.
const suspendsLikeClaudeCode = `
process.stdin.setRawMode(true);
process.stdin.resume();
console.log("ready");
process.stdin.on("data", (data) => {
  if (!data.includes(0x1a)) return;
  process.stdin.setRawMode(false);
  console.log("suspended");
  process.once("SIGCONT", () => {
    process.stdin.setRawMode(true);
    console.log("resumed");
  });
  process.kill(process.pid, "SIGTSTP");
});
setTimeout(() => process.exit(0), 20000);
`;

posixOnly("SuspendRescue with real terminals", () => {
  it("brings back a program that suspended itself with no shell above it", async () => {
    const host = new TerminalHost();
    hosts.push(host);
    host.createSession({ name: "agent", workingDirectory: process.cwd(), program: process.execPath, args: ["-e", suspendsLikeClaudeCode], environment: {} });
    await waitFor(async () => (await host.captureScreen("agent")).includes("ready"));
    const attachment = host.attach("agent", { send: () => undefined, close: () => undefined }, 80, 24)!;
    attachment.write("\x1a");
    await new SuspendRescue(new SystemTerminalState(host)).afterInput("agent", "\x1a");
    await waitFor(async () => (await host.captureScreen("agent")).includes("resumed"));
    attachment.detach();
  }, 20_000);

  it("leaves a command suspended in a shell suspended, for the shell's own fg", async () => {
    const host = new TerminalHost();
    hosts.push(host);
    host.createSession({ name: "shell", workingDirectory: "/tmp", program: "/bin/sh", args: ["-i"], environment: {} });
    await waitFor(() => !["", "sleep", undefined].includes(host.foregroundProgram("shell")));
    host.pasteText("shell", "sleep 30");
    host.pressKeys("shell", ["Enter"]);
    await waitFor(() => host.foregroundProgram("shell") === "sleep");
    const sleepPid = (await host.processesOnScreen("shell")).find((found) => found.args === "sleep 30")!.pid;
    const attachment = host.attach("shell", { send: () => undefined, close: () => undefined }, 80, 24)!;
    attachment.write("\x1a");
    await new SuspendRescue(new SystemTerminalState(host)).afterInput("shell", "\x1a");
    const state = (await execFileAsync("ps", ["-o", "stat=", "-p", String(sleepPid)])).stdout.trim();
    expect(state.startsWith("T")).toBe(true);
    attachment.detach();
  }, 20_000);
});
