// Callsign's own tmux server (a separate socket, so the user's tmux is never touched).

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface TmuxSessionInfo {
  name: string;
  currentPath: string;
  currentCommand: string;
}

export interface NewTmuxSession {
  name: string;
  workingDirectory: string;
  command: string;
  environment: Record<string, string>;
}

export class TmuxServer {
  constructor(private readonly socketName: string) {}

  async listSessions(): Promise<TmuxSessionInfo[]> {
    const output = await this.run(["list-sessions", "-F", "#{session_name}\t#{pane_current_path}\t#{pane_current_command}"]).catch(() => "");
    return output
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name = "", currentPath = "", currentCommand = ""] = line.split("\t");
        return { name, currentPath, currentCommand };
      });
  }

  async hasSession(name: string): Promise<boolean> {
    return this.run(["has-session", "-t", exactTarget(name)]).then(() => true, () => false);
  }

  async createSession(session: NewTmuxSession): Promise<void> {
    const environmentArguments = Object.entries(session.environment).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
    await this.run(["new-session", "-d", "-s", session.name, "-x", "200", "-y", "50", "-c", session.workingDirectory, ...environmentArguments, session.command]);
    // Size the window to the client that looked at it last; Callsign draws its own chrome.
    await this.run(["set-option", "-w", "-t", paneTarget(session.name), "window-size", "latest"]);
    await this.run(["set-option", "-t", paneTarget(session.name), "status", "off"]);
  }

  async killSession(name: string): Promise<void> {
    await this.run(["kill-session", "-t", exactTarget(name)]).catch(() => undefined);
  }

  // Pastes text as one bracketed paste, so newlines and symbols arrive as text, never as keys.
  async pasteText(name: string, text: string): Promise<void> {
    const bufferName = `callsign-${name}`;
    await this.runWithInput(["load-buffer", "-b", bufferName, "-"], text);
    await this.run(["paste-buffer", "-p", "-d", "-b", bufferName, "-t", paneTarget(name)]);
  }

  async pressKeys(name: string, keys: string[]): Promise<void> {
    await this.run(["send-keys", "-t", paneTarget(name), ...keys]);
  }

  async captureScreen(name: string): Promise<string> {
    return this.run(["capture-pane", "-p", "-t", paneTarget(name)]).catch(() => "");
  }

  // Arguments for a terminal client that shows this session (run inside a pseudo-terminal).
  attachCommand(name: string): { file: string; args: string[] } {
    return { file: "tmux", args: ["-L", this.socketName, "attach-session", "-t", exactTarget(name)] };
  }

  private async run(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("tmux", ["-L", this.socketName, ...args], { timeout: 5_000 });
    return stdout;
  }

  private runWithInput(args: string[], input: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn("tmux", ["-L", this.socketName, ...args], { stdio: ["pipe", "ignore", "pipe"] });
      let errorOutput = "";
      child.stderr.on("data", (chunk: Buffer) => (errorOutput += chunk.toString()));
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`tmux ${args[0]} failed: ${errorOutput.trim()}`))));
      child.stdin.end(input);
    });
  }
}

// "=name" stops tmux from matching a session by prefix.
function exactTarget(name: string): string {
  return `=${name}`;
}

// The active pane of the session's current window, for commands that act on a pane or window.
function paneTarget(name: string): string {
  return `=${name}:`;
}

export async function isTmuxInstalled(): Promise<boolean> {
  return execFileAsync("tmux", ["-V"]).then(() => true, () => false);
}
