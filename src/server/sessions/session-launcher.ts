// Starts, resumes, closes and types into agent sessions running in tmux.

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import { ScreenReader } from "./screen-reader.ts";
import { SessionResume } from "./session-resume.ts";
import type { SessionRegistry } from "./session-registry.ts";
import type { TmuxServer } from "../tmux/tmux-server.ts";
import type { SessionState, SessionView } from "../../shared/types.ts";

const execFileAsync = promisify(execFile);

export type DeliveryResult = "submitted" | "queued" | "failed";

// How long a session gets to report a submitted prompt before Callsign presses return again.
const promptConfirmationMilliseconds = 2_500;
// Pasted text needs a moment to settle in Claude Code's input before return is pressed.
const pasteSettleMilliseconds = 150;

export class SessionLauncher {
  constructor(
    private readonly tmux: TmuxServer,
    private readonly registry: SessionRegistry,
    private readonly claudeSettingsPath: string,
  ) {}

  async start(projectPath: string, projectName: string, task?: string): Promise<SessionView> {
    const name = this.uniqueName(projectName);
    const now = Date.now();
    const session: SessionView = {
      name,
      projectPath,
      projectName,
      agent: "claude",
      state: "starting",
      stateSince: now,
      createdAt: now,
      lastSeenAt: now,
      activitySinceSeen: [],
      waitedMillisecondsToday: 0,
    };
    this.registry.add(session);
    await this.tmux.createSession({ name, workingDirectory: projectPath, command: this.claudeCommand(name), environment: { CALLSIGN_SESSION: name } });
    if (task) void this.sendWhenReady(name, task);
    return session;
  }

  async resume(closed: SessionView): Promise<SessionView> {
    const now = Date.now();
    const session: SessionView = { ...closed, state: "starting", stateSince: now, lastSeenAt: now, pending: undefined, activitySinceSeen: [] };
    this.registry.add(session);
    const transcriptExists = closed.transcriptPath ? await fileExists(closed.transcriptPath) : undefined;
    const resumeArgument = SessionResume.claudeArguments(closed, { transcriptExists });
    await this.tmux.createSession({
      name: session.name,
      workingDirectory: session.projectPath,
      command: this.claudeCommand(session.name, resumeArgument),
      environment: { CALLSIGN_SESSION: session.name },
    });
    return session;
  }

  async close(name: string): Promise<void> {
    await this.tmux.killSession(name);
    this.registry.remove(name);
  }

  readScreen(name: string): Promise<string> {
    return this.tmux.captureScreen(name);
  }

  async interrupt(name: string): Promise<void> {
    await this.tmux.pressKeys(name, ["Escape"]);
  }

  // Reads the dialog again right before pressing keys, so the keys match what is on screen now.
  async trustFolder(name: string): Promise<boolean> {
    const keys = ScreenReader.trustDialogKeys(await this.tmux.captureScreen(name));
    if (!keys) return false;
    await this.tmux.pressKeys(name, keys);
    this.registry.update(name, (session) => ({ ...session, state: "starting", stateSince: Date.now() }));
    return true;
  }

  async deliverText(name: string, text: string): Promise<DeliveryResult> {
    const session = this.registry.get(name);
    if (!session) return "failed";
    // A working Claude Code session queues the text and submits it after its current step.
    const isWorking = session.state === "working";
    await this.tmux.pasteText(name, text);
    await delay(pasteSettleMilliseconds);
    const firstConfirmation = this.registry.waitForPromptSubmitted(name, promptConfirmationMilliseconds);
    await this.tmux.pressKeys(name, ["C-m"]);
    if (isWorking) return "queued";
    if (await firstConfirmation) return "submitted";
    // The probe of 24 October 2026 saw a return swallowed right after start; one more is safe.
    const secondConfirmation = this.registry.waitForPromptSubmitted(name, promptConfirmationMilliseconds);
    await this.tmux.pressKeys(name, ["C-m"]);
    return (await secondConfirmation) ? "submitted" : "failed";
  }

  async hasUncommittedChanges(name: string): Promise<boolean> {
    const session = this.registry.get(name);
    if (!session) return false;
    const status = await execFileAsync("git", ["-C", session.projectPath, "status", "--porcelain"], { timeout: 5_000 }).then(
      ({ stdout }) => stdout.trim(),
      () => "",
    );
    return status.length > 0;
  }

  // After a restart: keep saved sessions whose tmux session still runs, close the rest.
  // A Claude that quit by itself (/exit, a crash, a failed start) leaves its session under
  // "Recently closed", where it can be brought back, instead of a dead terminal.
  async sweepEndedSessions(): Promise<void> {
    const running = new Set((await this.tmux.listSessions()).map((session) => session.name));
    const now = Date.now();
    for (const session of this.registry.list()) {
      if (SessionResume.endedOnItsOwn(session, { terminalRunning: running.has(session.name), now })) this.registry.remove(session.name);
    }
  }

  async reconcileWithTmux(): Promise<void> {
    const running = new Set((await this.tmux.listSessions()).map((session) => session.name));
    for (const session of this.registry.list()) {
      if (session.origin === "external") {
        // Outside sessions report again on their next event; keep no stale copy.
        this.registry.forget(session.name);
        continue;
      }
      if (!running.has(session.name)) {
        this.registry.remove(session.name);
        continue;
      }
      // A hook held open before the restart is gone; the terminal dialog still shows it.
      if (session.pending) this.registry.update(session.name, (current) => ({ ...current, pending: undefined, state: "asked", blockedByTerminalDialog: true }));
    }
  }

  private async sendWhenReady(name: string, task: string): Promise<void> {
    const ready = await this.waitForState(name, ["idle", "done", "asked"], 120_000);
    if (ready) await this.deliverText(name, task);
  }

  private waitForState(name: string, states: SessionState[], timeoutMilliseconds: number): Promise<boolean> {
    return new Promise((resolve) => {
      const check = () => {
        const session = this.registry.get(name);
        if (!session || session.state === "stopped") return finish(false);
        if (states.includes(session.state)) finish(true);
      };
      const finish = (result: boolean) => {
        clearTimeout(timer);
        this.registry.off("changed", check);
        resolve(result);
      };
      const timer = setTimeout(() => finish(false), timeoutMilliseconds);
      this.registry.on("changed", check);
      check();
    });
  }

  private claudeCommand(name: string, extraArguments = ""): string {
    return `claude ${extraArguments} --settings ${shellQuote(this.claudeSettingsPath)} -n ${name}`.replace(/\s+/g, " ");
  }

  private uniqueName(projectName: string): string {
    const base = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "session";
    if (!this.registry.get(base)) return base;
    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!this.registry.get(candidate)) return candidate;
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
