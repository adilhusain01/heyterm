// Starts, resumes, closes and types into agent sessions, each running in one of HeyTerm's own
// terminals. When HeyTerm stops, its sessions stop too, and come back from "Recently closed".

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { ScreenReader } from "./screen-reader.ts";
import { ShellRules } from "./shell-rules.ts";
import { ClaudeConversationFile } from "./claude-conversation-file.ts";
import { ClaudeSessionRecords } from "./claude-session-watcher.ts";
import { ConversationOwner } from "./conversation-owner.ts";
import type { SessionWorktrees, WorktreeRemoval } from "./session-worktrees.ts";
import { WorktreePlan } from "./worktree-plan.ts";
import { AgentAdapters, type AgentLaunchContext } from "../agents/agent-adapters.ts";
import { HookCommands } from "../hooks/hook-commands.ts";
import { LaunchCommand } from "../terminals/launch-command.ts";
import type { SessionRegistry } from "./session-registry.ts";
import type { TerminalHost } from "../terminals/terminal-host.ts";
import type { AgentKind, SessionState, SessionView, SessionWorktree } from "../../shared/types.ts";

const execFileAsync = promisify(execFile);

export type DeliveryResult = "submitted" | "queued" | "failed";

// How long a session gets to report a submitted prompt before HeyTerm presses return again.
const promptConfirmationMilliseconds = 2_500;
// Pasted text needs a moment to settle in the agent's input before return is pressed.
const pasteSettleMilliseconds = 150;
// A command the assistant runs in a terminal: how long until its program shows, how often to look
// whether it is done, and how long to wait at most before reading the screen anyway.
const commandStartMilliseconds = 300;
const commandPollMilliseconds = 200;
const terminalCommandWaitMilliseconds = 15_000;

interface LauncherPaths {
  claudeSettingsPath: string;
  forwardScriptPath: string;
}

export class AgentNotInstalledError extends Error {}

// How long a session in the user's terminal gets to quit before HeyTerm gives up moving it.
const adoptExitWaitMilliseconds = 8_000;

export class SessionLauncher {
  constructor(
    private readonly host: TerminalHost,
    private readonly registry: SessionRegistry,
    private readonly paths: LauncherPaths,
    private readonly worktrees?: SessionWorktrees,
  ) {
    // A program that ends by itself (/exit, a crash, a failed start) moves its session to "Recently closed".
    host.on("exit", (name) => this.registry.remove(name));
  }

  async start(projectPath: string, projectName: string, task?: string, agent: AgentKind = "claude"): Promise<SessionView> {
    await this.ensureInstalled(agent);
    const isTerminal = agent === "shell";
    const name = this.uniqueName(isTerminal ? ShellRules.sessionName(projectName) : projectName);
    // A second agent in a folder another open session uses works in a git worktree of its own.
    const sharesAFolder = WorktreePlan.needsOwnWorktree(projectPath, this.registry.list(), agent);
    const made = sharesAFolder && this.worktrees ? await this.worktrees.create(projectPath, name) : undefined;
    const now = Date.now();
    const session: SessionView = {
      name,
      projectPath: made?.path ?? projectPath,
      ...(made ? { worktree: { repoPath: made.repoPath, worktreePath: made.worktreePath, branch: made.branch, baseCommit: made.baseCommit } } : {}),
      projectName,
      agent,
      // A shell sends no hooks to say it is up; it takes typing as soon as it starts.
      state: isTerminal ? "idle" : "starting",
      stateSince: now,
      createdAt: now,
      lastSeenAt: now,
      activitySinceSeen: [],
      waitedMillisecondsToday: 0,
      // Grok's hooks come from a global file; the id HeyTerm gives it is how its events find this session.
      agentSessionId: AgentAdapters.get(agent).choosesSessionIdAtLaunch ? randomUUID() : undefined,
    };
    this.registry.add(session);
    this.launch(session, AgentAdapters.get(agent).newSession({ ...this.launchContext(name), agentSessionId: session.agentSessionId }));
    if (task) void this.sendWhenReady(name, task);
    return session;
  }

  async resume(closed: SessionView): Promise<SessionView> {
    await this.ensureInstalled(closed.agent);
    if (ConversationOwner.liveProcess(closed, await ClaudeSessionRecords.read(), ClaudeSessionRecords.processIsRunning)) {
      throw new Error(`${closed.name}'s conversation is still open in another terminal. Close it there, or say "open ${closed.name} here" to move it.`);
    }
    const conversationFile = closed.agent === "claude" && closed.agentSessionId ? await ClaudeConversationFile.find(closed.agentSessionId, closed.transcriptPath) : undefined;
    const conversationFolder = conversationFile ? await ClaudeConversationFile.lastFolder(conversationFile) : undefined;
    const reopenedHere = ConversationOwner.reopenedHere(closed, Date.now());
    const reopened: SessionView = closed.agent === "shell" ? { ...reopenedHere, state: "idle" } : reopenedHere;
    const session = conversationFile && conversationFolder && (await isFolder(conversationFolder)) ? ConversationOwner.inItsConversationsFolder(reopened, conversationFolder, conversationFile) : reopened;
    // Left behind with nothing in it, the worktree goes; with changes or commits it stays.
    if (closed.worktree && !session.worktree) void this.removeWorktreeIfUnused(closed.worktree).catch(() => undefined);
    this.registry.add(session);
    const conversationSaved = closed.agent === "claude" ? conversationFile !== undefined : closed.transcriptPath ? await fileExists(closed.transcriptPath) : closed.lastPrompt !== undefined;
    const point = { agentSessionId: closed.agentSessionId, conversationSaved };
    const adapter = AgentAdapters.get(closed.agent);
    // A conversation that was never saved starts again, under a new id where the agent takes one.
    if (adapter.choosesSessionIdAtLaunch && !conversationSaved) this.registry.update(session.name, (current) => ({ ...current, agentSessionId: randomUUID() }));
    const launchId = this.registry.get(session.name)?.agentSessionId;
    this.launch(session, adapter.resume(point, { ...this.launchContext(session.name), agentSessionId: launchId }));
    return session;
  }

  // Text into the session's prompt as a paste, without pressing Enter: the user adds words and sends.
  pasteIntoPrompt(name: string, text: string): void {
    this.host.pasteText(name, text);
  }

  // Moves a session from the user's own terminal into HeyTerm: its Claude there is asked to quit
  // (SIGTERM, which Claude Code exits cleanly on), then the same conversation opens here.
  async adopt(name: string): Promise<SessionView> {
    const session = this.registry.get(name);
    if (!session || session.origin !== "external") throw new Error(`${name} is not a session in your own terminal.`);
    const pid = ConversationOwner.liveProcess(session, await ClaudeSessionRecords.read(), ClaudeSessionRecords.processIsRunning);
    if (pid !== undefined) {
      process.kill(pid, "SIGTERM");
      for (let waited = 0; waited < adoptExitWaitMilliseconds && ClaudeSessionRecords.processIsRunning(pid); waited += 200) await new Promise((resolve) => setTimeout(resolve, 200));
      if (ClaudeSessionRecords.processIsRunning(pid)) throw new Error(`${name} did not close in your terminal. Quit it there, then say "bring back ${name}".`);
    }
    this.registry.remove(name);
    const closed = this.registry.recentlyClosedSessions().find((candidate) => candidate.name === name);
    if (!closed) throw new Error(`${name} could not be reopened here.`);
    return this.resume(closed);
  }

  // When a closed session leaves the list, its worktree goes too, unless that would lose work.
  removeWorktreeIfUnused(worktree: SessionWorktree): Promise<WorktreeRemoval> {
    return this.worktrees ? this.worktrees.removeIfUnused(worktree) : Promise.resolve("missing");
  }

  // Returns why the session could not take the name, or undefined once it has.
  rename(currentName: string, newName: string): string | undefined {
    const problem = this.registry.rename(currentName, newName);
    if (!problem) this.host.renameSession(currentName, newName);
    return problem;
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
    // A shell sends no prompt hook to confirm with; one return runs the command.
    if (session.agent === "shell") {
      this.host.pasteText(name, text);
      await delay(pasteSettleMilliseconds);
      this.host.pressKeys(name, ["Enter"]);
      return "submitted";
    }
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

  isCommandRunning(name: string): boolean {
    const session = this.registry.get(name);
    return session?.agent === "shell" && ShellRules.isCommandRunning(this.host.foregroundProgram(name), AgentAdapters.get("shell").program);
  }

  // For the assistant: runs a command in a terminal session and waits, up to a limit, for the shell
  // to come back, so what it reads is the command's output and not the moment after return.
  async runInTerminal(name: string, command: string, longestWaitMilliseconds = terminalCommandWaitMilliseconds): Promise<{ finished: boolean; screen: string }> {
    if ((await this.deliverText(name, command)) === "failed") return { finished: false, screen: "" };
    await delay(commandStartMilliseconds);
    const startedAt = Date.now();
    while (this.isCommandRunning(name) && Date.now() - startedAt < longestWaitMilliseconds) await delay(commandPollMilliseconds);
    const finished = !this.isCommandRunning(name);
    await delay(commandStartMilliseconds);
    return { finished, screen: await this.host.captureScreen(name) };
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

  // HeyTerm's own sessions ended with it. Sessions in the user's terminal stay, names and all:
  // ClaudeSessionWatcher closes the ones whose Claude has gone.
  restoreAfterStart(): void {
    for (const session of this.registry.list()) if (session.origin !== "external") this.registry.remove(session.name);
  }

  // HeyTerm is stopping: every session ends and waits under "Recently closed" for next time.
  shutdown(): void {
    for (const session of this.registry.list()) if (session.origin !== "external") this.registry.remove(session.name);
    this.host.shutdown();
  }

  private launch(session: SessionView, agentLaunch: { program: string; args: string[] }): void {
    const { file, args } = LaunchCommand.forPlatform(agentLaunch.program, agentLaunch.args);
    try {
      // Without HEYTERM_SESSION in a terminal, an agent started inside it reports as a session of the
      // developer's own, instead of under the terminal's name, which sends no hooks.
      const environment: Record<string, string> = session.agent === "shell" ? {} : { HEYTERM_SESSION: session.name };
      const leaveOut = session.agent === "shell" ? ShellRules.variablesLeftOut : [];
      this.host.createSession({ name: session.name, workingDirectory: session.projectPath, program: file, args, environment, leaveOut });
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
    if (!this.registry.isNameInUse(base)) return base;
    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!this.registry.isNameInUse(candidate)) return candidate;
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

async function isFolder(folderPath: string): Promise<boolean> {
  try {
    return (await stat(folderPath)).isDirectory();
  } catch {
    return false;
  }
}
