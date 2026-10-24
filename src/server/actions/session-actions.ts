// Actions on whole sessions: deliver text, start, resume, close, interrupt, trust, status, catch up.

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
