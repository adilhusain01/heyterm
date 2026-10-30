// HeyTerm starts each session's program with no shell above it: LaunchCommand execs it, so it leads
// its terminal's session. When such a program suspends itself, as Claude Code does on Ctrl+Z, the
// system drops the stop signal, since nothing above the program could ever resume it, while the
// program has already handed the terminal back and waits for the signal fg sends. Its screen stays
// dead for good (layoutgen, 30 October 2026). So after Ctrl+Z, HeyTerm sends that signal itself once
// the terminal is back in line mode. Only the program leading the terminal gets it, never a job a
// shell put in front, so Ctrl+Z in a shell still suspends the command there.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Terminals } from "./terminals.ts";

const execFileAsync = promisify(execFile);
const suspendKey = "\x1a";
// Pauses before each look at the terminal: a program takes a moment to hand it back, a busy one
// longer. About two seconds in all.
const checkPauses = [100, 200, 500, 1_200];

export interface TerminalState {
  leaderPid: number;
  // Line mode is what a program leaves the terminal in when it lets go of it.
  isInLineMode: boolean;
}

export interface SuspendRescueSystem {
  readState(sessionName: string): Promise<TerminalState | undefined>;
  resume(pid: number): void;
  wait(milliseconds: number): Promise<void>;
}

export class SuspendRescue {
  private readonly watched = new Set<string>();

  constructor(private readonly system: SuspendRescueSystem) {}

  // After input reached a session's terminal. Resolves when the watch is over.
  async afterInput(sessionName: string, data: string): Promise<void> {
    if (!data.includes(suspendKey) || this.watched.has(sessionName)) return;
    this.watched.add(sessionName);
    try {
      await this.watch(sessionName);
    } finally {
      this.watched.delete(sessionName);
    }
  }

  // The session leader in `ps -o pid=,stat=,tty=` output: "s" in its state, on macOS and Linux.
  static leaderOf(listing: string): { pid: number; tty: string } | undefined {
    for (const line of listing.split("\n")) {
      const match = /^\s*(\d+)\s+(\S+)\s+(\S+)\s*$/.exec(line);
      if (match && match[2]!.includes("s")) return { pid: Number(match[1]), tty: match[3]! };
    }
    return undefined;
  }

  // From `stty -a`: "icanon" is line mode, "-icanon" a program's own.
  static isLineMode(modes: string): boolean {
    return /(?<![-\w])icanon\b/.test(modes);
  }

  private async watch(sessionName: string): Promise<void> {
    let hasResumed = false;
    for (const pause of checkPauses) {
      await this.system.wait(pause);
      const state = await this.system.readState(sessionName);
      if (!state) return;
      if (state.isInLineMode) {
        // Sent again at the next look if the program was not yet waiting for it.
        this.system.resume(state.leaderPid);
        hasResumed = true;
      } else if (hasResumed) {
        return;
      }
    }
  }
}

// Reads a terminal on this computer with ps and stty, which every macOS and Linux has. Windows has
// no such signals, and lists no programs on a terminal, so nothing is resumed there.
export class SystemTerminalState implements SuspendRescueSystem {
  constructor(
    private readonly terminals: Pick<Terminals, "processesOnScreen">,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  async readState(sessionName: string): Promise<TerminalState | undefined> {
    const processes = await this.terminals.processesOnScreen(sessionName);
    if (processes.length === 0) return undefined;
    const leader = SuspendRescue.leaderOf(await output("ps", ["-o", "pid=,stat=,tty=", "-p", processes.map((found) => found.pid).join(",")]));
    if (!leader) return undefined;
    const modes = await output("stty", ["-a", this.platform === "linux" ? "-F" : "-f", `/dev/${leader.tty}`]);
    if (!modes) return undefined;
    return { leaderPid: leader.pid, isInLineMode: SuspendRescue.isLineMode(modes) };
  }

  resume(pid: number): void {
    try {
      process.kill(pid, "SIGCONT");
    } catch {
      // It ended meanwhile.
    }
  }

  wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}

async function output(file: string, args: string[]): Promise<string> {
  return (await execFileAsync(file, args, { timeout: 3_000 }).catch(() => ({ stdout: "" }))).stdout;
}
