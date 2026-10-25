// Actions on whole sessions: deliver text, start, resume, close, interrupt, trust, status, catch up.

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ChangeSummary, type ChangeSummaryResult } from "../../shared/change-summary.ts";
import { CatchUpDigest, type SessionDigest } from "../../shared/catch-up.ts";
import { SessionLifecycle } from "../sessions/session-lifecycle.ts";
import type { ProjectCatalog } from "../projects/project-catalog.ts";
import type { AuditLog } from "../safety/audit-log.ts";
import type { SessionLauncher } from "../sessions/session-launcher.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { Feedback } from "../../shared/protocol.ts";
import type { RouterAction } from "../../shared/types.ts";

type SessionAction = Extract<RouterAction, { type: "spawn" | "resume" | "interrupt" | "trust" | "status" }>;

export class SessionActions {
  constructor(
    private readonly registry: SessionRegistry,
    private readonly launcher: SessionLauncher,
    private readonly projects: ProjectCatalog,
    private readonly audit: AuditLog,
  ) {}

  async perform(action: RouterAction, focus: (sessionName: string) => void): Promise<Feedback> {
    switch (action.type) {
      case "spawn":
        return this.spawn(action, focus);
      case "resume":
        return this.resume(action.session, focus);
      case "interrupt":
        await this.launcher.interrupt(action.session);
        return { text: `Interrupted ${action.session}.`, tone: "info", speak: false };
      case "trust":
        return this.trust(action.session);
      case "status":
        return this.status(action.session);
      case "changes":
        return { text: (await this.changes(action.session)).spoken, tone: "info", speak: true };
      default:
        return { text: "I did not catch what to do.", tone: "warning", speak: true };
    }
  }

  async deliver(sessionName: string, text: string): Promise<Feedback> {
    this.markSeen(sessionName);
    const result = await this.launcher.deliverText(sessionName, text);
    if (result === "submitted") return { text: `Sent to ${sessionName}.`, tone: "success", speak: false };
    if (result === "queued") return { text: `Queued for ${sessionName}; it reads it after its current step.`, tone: "info", speak: false };
    return { text: `${sessionName} did not take the message. Check its terminal.`, tone: "error", speak: true };
  }

  // The files the session's own edits touched in its last task, with git's line counts where git has them.
  async changes(sessionName: string): Promise<ChangeSummaryResult> {
    const session = this.registry.get(sessionName) ?? this.registry.recentlyClosedSessions().find((closed) => closed.name === sessionName);
    if (!session) return { files: [], spoken: `There is no session called ${sessionName}.` };
    const files = session.filesChangedInLastTask ?? [];
    if (files.length === 0) return ChangeSummary.describe(sessionName, files, undefined);
    const numstat = await runGit(session.projectPath, ["diff", "--numstat", "--relative", "HEAD", "--", ...files]);
    if (numstat === undefined) return ChangeSummary.describe(sessionName, files, undefined);
    const counts = ChangeSummary.parseNumstat(numstat);
    // A new file git does not track yet is all added lines.
    for (const file of files) {
      if (counts.has(file)) continue;
      const text = await readFile(path.join(session.projectPath, file), "utf8").catch(() => undefined);
      if (text !== undefined && text.length < 1_000_000) counts.set(file, { added: text.split("\n").filter((line, index, lines) => line !== "" || index < lines.length - 1).length, removed: 0 });
    }
    return ChangeSummary.describe(sessionName, files, counts);
  }

  async adopt(sessionName: string, focus: (sessionName: string) => void): Promise<Feedback> {
    try {
      const session = await this.launcher.adopt(sessionName);
      focus(session.name);
      return { text: `Moved ${session.name} here. It closed in your terminal, and its conversation goes on in HeyTerm.`, tone: "success", speak: true };
    } catch (error) {
      return { text: error instanceof Error ? error.message : String(error), tone: "warning", speak: true };
    }
  }

  // Off the list, and its worktree with it when nothing in the worktree would be lost.
  async forgetClosed(sessionName: string): Promise<Feedback> {
    const closed = this.registry.recentlyClosedSessions().find((session) => session.name === sessionName);
    if (!closed || !this.registry.forgetClosed(sessionName)) return { text: `There is no closed session called ${sessionName}.`, tone: "warning", speak: false };
    const removed = `Removed ${sessionName} from the list. Its conversation is still there to resume.`;
    if (!closed.worktree) return { text: removed, tone: "info", speak: false };
    const worktree = await this.launcher.removeWorktreeIfUnused(closed.worktree);
    if (worktree === "kept_uncommitted") return { text: `${removed} Its worktree has uncommitted changes, so it stays at ${closed.worktree.worktreePath}.`, tone: "info", speak: false };
    if (worktree === "kept_commits") return { text: `${removed} Its branch ${closed.worktree.branch} has commits of its own, so the worktree stays at ${closed.worktree.worktreePath}.`, tone: "info", speak: false };
    return { text: `${removed} Its worktree is deleted; nothing in it was lost.`, tone: "info", speak: false };
  }

  rename(sessionName: string, newName: string): string | undefined {
    return this.launcher.rename(sessionName, newName);
  }

  async close(sessionName: string): Promise<Feedback> {
    await this.launcher.close(sessionName);
    await this.audit.record({ session: sessionName, decision: "closed", subject: sessionName, decidedBy: "voice or click" });
    return { text: `Closed ${sessionName}. Say bring back ${sessionName} to resume it.`, tone: "info", speak: false };
  }

  hasUncommittedChanges(sessionName: string): Promise<boolean> {
    return this.launcher.hasUncommittedChanges(sessionName);
  }

  catchUp(sessionName: string | undefined): SessionDigest[] {
    const sessions = sessionName ? this.registry.list().filter((session) => session.name === sessionName) : this.registry.list();
    const digests = sessionName ? sessions.map((session) => CatchUpDigest.forSession(session)) : CatchUpDigest.forAll(sessions);
    for (const digest of digests) this.markSeen(digest.sessionName);
    return digests;
  }

  markSeen(sessionName: string): void {
    this.registry.update(sessionName, (session) => SessionLifecycle.markSeen(session, Date.now()));
  }

  private async spawn(action: Extract<SessionAction, { type: "spawn" }>, focus: (sessionName: string) => void): Promise<Feedback> {
    const project = await this.projects.find(action.project);
    if (!project) return { text: `I could not find a project called ${action.project}.`, tone: "warning", speak: true };
    let session;
    try {
      session = await this.launcher.start(project.path, project.name, action.task, action.agent);
    } catch (error) {
      return { text: error instanceof Error ? error.message : String(error), tone: "warning", speak: true };
    }
    focus(session.name);
    const taskNote = action.task ? " It gets the task once it is ready." : "";
    if (session.worktree) {
      return { text: `Starting ${session.name} in a copy of the folder of its own, on a new branch, so it and the other session there cannot change each other's files. It starts from the last commit.${taskNote}`, tone: "success", speak: true };
    }
    const sharing = this.registry.list().find((other) => other.name !== session.name && other.projectPath === session.projectPath);
    if (sharing) return { text: `Starting ${session.name}. It shares ${sharing.name}'s folder, which is not a git repository, so the two can change each other's files.${taskNote}`, tone: "warning", speak: true };
    return { text: `Starting ${session.name}.${taskNote}`, tone: "success", speak: false };
  }

  private async resume(sessionName: string, focus: (sessionName: string) => void): Promise<Feedback> {
    const closed = this.registry.recentlyClosedSessions().find((session) => session.name === sessionName);
    if (!closed) return { text: `${sessionName} is not in the recently closed list.`, tone: "warning", speak: true };
    let session;
    try {
      session = await this.launcher.resume(closed);
    } catch (error) {
      return { text: error instanceof Error ? error.message : String(error), tone: "warning", speak: true };
    }
    focus(session.name);
    if (session.projectPath !== closed.projectPath) {
      // Its conversation was opened from another folder with /resume, and Claude Code keeps it there.
      const neighbour = this.registry.list().find((other) => other.name !== session.name && other.projectPath === session.projectPath);
      const sharing = neighbour ? ` It shares that folder with ${neighbour.name}.` : "";
      return { text: `Bringing back ${session.name} in ${session.projectPath}, the folder its conversation runs in.${sharing}`, tone: neighbour ? "warning" : "success", speak: false };
    }
    return { text: `Bringing back ${session.name}.`, tone: "success", speak: false };
  }

  private async trust(sessionName: string): Promise<Feedback> {
    const trusted = await this.launcher.trustFolder(sessionName);
    if (!trusted) return { text: `${sessionName} is not showing the trust dialog.`, tone: "warning", speak: true };
    await this.audit.record({ session: sessionName, decision: "trusted", subject: this.registry.get(sessionName)?.projectPath ?? sessionName, decidedBy: "voice or click" });
    return { text: `Trusted the folder for ${sessionName}.`, tone: "success", speak: false };
  }

  private status(sessionName: string): Feedback {
    const session = this.registry.get(sessionName);
    if (!session) return { text: `There is no session called ${sessionName}.`, tone: "warning", speak: true };
    const digest = CatchUpDigest.forSession(session);
    const prompt = session.lastPrompt ? ` Its last task: ${session.lastPrompt.slice(0, 120)}.` : "";
    this.markSeen(sessionName);
    return { text: `${digest.spoken}${prompt}`, tone: "info", speak: true };
  }
}

const execFileAsync = promisify(execFile);

// Git's output, or undefined outside a repository or on any failure.
function runGit(folder: string, args: string[]): Promise<string | undefined> {
  return execFileAsync("git", ["-C", folder, ...args], { timeout: 5_000 }).then(
    ({ stdout }) => stdout,
    () => undefined,
  );
}
