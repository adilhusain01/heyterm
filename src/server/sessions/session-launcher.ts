// Starts, resumes, closes and types into agent sessions, each running in one of Callsign's own
// terminals. When Callsign stops, its sessions stop too, and come back from "Recently closed".

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import { ScreenReader } from "./screen-reader.ts";
import { AgentAdapters, type AgentLaunchContext } from "../agents/agent-adapters.ts";
import { HookCommands } from "../hooks/hook-commands.ts";
import { LaunchCommand } from "../terminals/launch-command.ts";
import type { SessionRegistry } from "./session-registry.ts";
import type { TerminalHost } from "../terminals/terminal-host.ts";
import type { AgentKind, SessionState, SessionView } from "../../shared/types.ts";

const execFileAsync = promisify(execFile);

export type DeliveryResult = "submitted" | "queued" | "failed";

// How long a session gets to report a submitted prompt before Callsign presses return again.
const promptConfirmationMilliseconds = 2_500;
// Pasted text needs a moment to settle in the agent's input before return is pressed.
const pasteSettleMilliseconds = 150;

interface LauncherPaths {
  claudeSettingsPath: string;
  forwardScriptPath: string;
}

export class AgentNotInstalledError extends Error {}

export class SessionLauncher {
  constructor(
    private readonly host: TerminalHost,
    private readonly registry: SessionRegistry,
    private readonly paths: LauncherPaths,
  ) {
    // A program that ends by itself (/exit, a crash, a failed start) moves its session to "Recently closed".
    host.on("exit", (name) => this.registry.remove(name));
  }

  async start(projectPath: string, projectName: string, task?: string, agent: AgentKind = "claude"): Promise<SessionView> {
    await this.ensureInstalled(agent);
    const name = this.uniqueName(projectName);
    const now = Date.now();
    const session: SessionView = {
      name,
      projectPath,
      projectName,
      agent,
      state: "starting",
      stateSince: now,
      createdAt: now,
      lastSeenAt: now,
      activitySinceSeen: [],
      waitedMillisecondsToday: 0,
    };
    this.registry.add(session);
    this.launch(session, AgentAdapters.get(agent).newSession(this.launchContext(name)));
    if (task) void this.sendWhenReady(name, task);
    return session;
  }

  async resume(closed: SessionView): Promise<SessionView> {
    await this.ensureInstalled(closed.agent);
    const now = Date.now();
    const session: SessionView = { ...closed, state: "starting", stateSince: now, lastSeenAt: now, pending: undefined, activitySinceSeen: [] };
    this.registry.add(session);
    const conversationSaved = closed.transcriptPath ? await fileExists(closed.transcriptPath) : closed.lastPrompt !== undefined;
    const point = { agentSessionId: closed.agentSessionId, conversationSaved };
    this.launch(session, AgentAdapters.get(closed.agent).resume(point, this.launchContext(session.name)));
    return session;
  }

  async close(name: string): Promise<void> {
    this.host.killSession(name);
    this.registry.remove(name);
  }

  readScreen(name: string): Promise<string> {
    return this.host.captureScreen(name);
  }

  async interrupt(name: string): Promise<void> {
    this.host.pressKeys(name, ["Escape"]);
  }

  // Reads the dialog again right before pressing keys, so the keys match what is on screen now.
  async trustFolder(name: string): Promise<boolean> {
    const keys = ScreenReader.trustDialogKeys(await this.host.captureScreen(name));
    if (!keys) return false;
    this.host.pressKeys(name, keys);
    // After a folder, the agent starts and reports in. After Codex's hook review it is already up, and
    // its start event ran before the hooks were trusted, so it is ready now.
    this.registry.update(name, (session) => ({ ...session, state: session.trustSubject === "hooks" ? "idle" : "starting", stateSince: Date.now(), trustSubject: undefined }));
    return true;
  }

  async deliverText(name: string, text: string): Promise<DeliveryResult> {
    const session = this.registry.get(name);
    if (!session || !this.host.hasSession(name)) return "failed";
    // A working agent queues the text and submits it after its current step.
    const isWorking = session.state === "working";
    this.host.pasteText(name, text);
    await delay(pasteSettleMilliseconds);
    const firstConfirmation = this.registry.waitForPromptSubmitted(name, promptConfirmationMilliseconds);
    this.host.pressKeys(name, ["Enter"]);
    if (isWorking) return "queued";
    if (await firstConfirmation) return "submitted";
    // The probe of 24 October 2026 saw a return swallowed right after start; one more is safe.
    const secondConfirmation = this.registry.waitForPromptSubmitted(name, promptConfirmationMilliseconds);
    this.host.pressKeys(name, ["Enter"]);
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

  // At start nothing is running yet: sessions saved last time are offered under "Recently closed",
  // and outside sessions report again on their next event.
  restoreAfterStart(): void {
    for (const session of this.registry.list()) {
      if (session.origin === "external") this.registry.forget(session.name);
      else this.registry.remove(session.name);
    }
  }

  // Callsign is stopping: every session ends and waits under "Recently closed" for next time.
  shutdown(): void {
    for (const session of this.registry.list()) if (session.origin !== "external") this.registry.remove(session.name);
    this.host.shutdown();
  }

  private launch(session: SessionView, agentLaunch: { program: string; args: string[] }): void {
    const { file, args } = LaunchCommand.forPlatform(agentLaunch.program, agentLaunch.args);
    try {
      this.host.createSession({ name: session.name, workingDirectory: session.projectPath, program: file, args, environment: { CALLSIGN_SESSION: session.name } });
    } catch (error) {
      this.registry.remove(session.name);
      throw error;
    }
  }

  private launchContext(sessionName: string): AgentLaunchContext {
    return {
      sessionName,
      claudeSettingsPath: this.paths.claudeSettingsPath,
      hookCommand: (eventName) => HookCommands.forSession(this.paths.forwardScriptPath, eventName),
    };
  }

  private async ensureInstalled(agent: AgentKind): Promise<void> {
    const adapter = AgentAdapters.get(agent);
    if (!(await isOnPath(adapter.program))) throw new AgentNotInstalledError(`${adapter.label} is not installed. ${adapter.installHint}`);
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

  private uniqueName(projectName: string): string {
    const base = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "session";
    if (!this.registry.get(base)) return base;
    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!this.registry.get(candidate)) return candidate;
    }
  }
}

async function isOnPath(program: string): Promise<boolean> {
  const finder = process.platform === "win32" ? "where" : "which";
  return execFileAsync(finder, [program], { timeout: 5_000 }).then(
    () => true,
    () => false,
  );
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
