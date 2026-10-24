// A small stand-in for the Callsign server that runs in the browser, so anyone can try Callsign from a
// link. It routes words with the real fast path and acts out three agents from a script.

import { CatchUpDigest } from "../../shared/catch-up.ts";
import { AttentionQueue } from "../../shared/attention.ts";
import { FastPathRouter, acceptsText } from "../../server/router/fast-path-router.ts";
import { forcePushRequest, playgroundAgents, playgroundProjects, playgroundTimeline, scriptedReply } from "./playground-script.ts";
import { PlaygroundTerminals } from "./playground-terminals.ts";
import type { ClientMessage, ControlState, Feedback, ServerMessage } from "../../shared/protocol.ts";
import type { ActivityEntry, RouterAction, SessionState, SessionView } from "../../shared/types.ts";

const previewMilliseconds = 1_500;
const waitingStates: SessionState[] = ["needs_permission", "asked", "needs_trust", "done", "failed"];

export class PlaygroundWorld {
  readonly terminals = new PlaygroundTerminals();
  private readonly sessions = new Map<string, SessionView>();
  private control: ControlState = { mode: "speak", routing: false };
  private confirmation: (() => void) | undefined;
  private previewTimer: number | undefined;
  private readonly router = new FastPathRouter();
  private emit: (message: ServerMessage) => void = () => undefined;

  start(emit: (message: ServerMessage) => void): void {
    this.emit = emit;
    const now = Date.now();
    for (const agent of playgroundAgents) {
      this.sessions.set(agent.name, newSession(agent.name, agent.projectPath, now));
      this.deliver(agent.name, agent.firstPrompt, agent.workingLines, undefined);
    }
    for (const event of playgroundTimeline) window.setTimeout(() => this.playEvent(event), event.at * 1_000);
    this.snapshot();
  }

  receive(message: ClientMessage): void {
    if (message.type === "utterance") this.hear(message.text);
    if (message.type === "action") this.perform(message.action);
    if (message.type === "focus") this.perform({ type: "focus", session: message.session });
    if (message.type === "setup_refresh") this.tell({ text: "This is the playground: the agents are simulated. Install Callsign to run your own.", tone: "info", speak: false });
  }

  private hear(text: string): void {
    this.control = { ...this.control, lastHeard: text };
    const sessions = [...this.sessions.values()];
    const action = this.router.route(text, {
      sessions,
      projectNames: playgroundProjects,
      attentionHead: AttentionQueue.build(sessions)[0],
      focusedSession: this.control.focusedSession,
      hasPendingPreview: this.control.preview !== undefined,
    });
    if (this.control.preview && action?.type !== "cancel" && action?.type !== "send_now") this.sendPreviewNow();
    if (action) return this.perform(action);
    this.tell({ text: 'The playground understands the common commands. Start with a name, like "api, run the tests", or say "catch me up".', tone: "info", speak: true });
  }

  private perform(action: RouterAction): void {
    switch (action.type) {
      case "send":
        return this.send(action.session, action.text, action.needsPreview);
      case "send_now":
        return this.sendPreviewNow();
      case "cancel":
        window.clearTimeout(this.previewTimer);
        this.confirmation = undefined;
        this.control = { ...this.control, preview: undefined, confirmation: undefined };
        return this.tell({ text: "Cancelled.", tone: "info", speak: false });
      case "answer": {
        const answer = Object.values(action.answers).join(", ");
        this.terminals.write(action.session, `\r\n  \x1b[2mYou answered:\x1b[0m ${answer}\r\n`);
        return this.deliver(action.session, undefined, ["Edit src/checkout/totals.ts", "Ran pnpm test checkout"], `Applied coupons ${answer.toLowerCase()} free shipping and added a test for it. 48 tests pass.`);
      }
      case "approve":
        return this.approve(action.session, action.requestId, action.confirmed);
      case "deny": {
        this.terminals.write(action.session, `\r\n  \x1b[31mDenied\x1b[0m${action.reason ? `: ${action.reason}` : ""}\r\n`);
        return this.deliver(action.session, undefined, [], `Understood, I did not run it.${action.reason ? ` I'll ${action.reason} instead.` : ""}`);
      }
      case "confirm":
        return this.runConfirmation();
      case "catch_up": {
        const digests = CatchUpDigest.forAll([...this.sessions.values()]);
        this.emit({ type: "catch_up", digests });
        for (const digest of digests) this.markSeen(digest.sessionName);
        return this.tell({ text: digests.length ? digests.map((digest) => digest.spoken).join(" ") : "Nothing new since you last looked.", tone: "info", speak: true });
      }
      case "status": {
        const session = this.sessions.get(action.session);
        return session ? this.tell({ text: CatchUpDigest.forSession(session).spoken, tone: "info", speak: true }) : undefined;
      }
      case "focus":
        this.control = { ...this.control, focusedSession: action.session };
        this.markSeen(action.session);
        return this.emit({ type: "focus", session: action.session });
      case "spawn":
        return this.spawn(action.project, action.task);
      case "close":
        this.sessions.delete(action.session);
        this.snapshot();
        return this.tell({ text: `Closed ${action.session}.`, tone: "info", speak: false });
      case "interrupt":
        this.terminals.write(action.session, "\r\n  \x1b[33mInterrupted\x1b[0m\r\n");
        return this.setState(action.session, "idle");
      case "mode":
        this.control = { ...this.control, mode: action.mode };
        this.snapshot();
        return this.tell({ text: `${action.mode === "speak" ? "Speaking" : action.mode === "quiet" ? "Quiet mode" : "Muted"}.`, tone: "info", speak: action.mode !== "mute" });
      default:
        return this.tell({ text: "The playground doesn't act that one out. Install Callsign to try it for real.", tone: "info", speak: true });
    }
  }

  private send(sessionName: string, text: string, needsPreview: boolean): void {
    const session = this.sessions.get(sessionName);
    if (!session) return;
    if (!acceptsText(session)) return this.tell({ text: `${sessionName} is waiting on a decision first.`, tone: "warning", speak: true });
    if (!needsPreview) return this.deliver(sessionName, text, ["Read src/index.ts"], scriptedReply(sessionName, text));
    window.clearTimeout(this.previewTimer);
    this.control = { ...this.control, preview: { session: sessionName, text, deadline: Date.now() + previewMilliseconds } };
    this.previewTimer = window.setTimeout(() => this.sendPreviewNow(), previewMilliseconds);
    this.snapshot();
  }

  private sendPreviewNow(): void {
    const preview = this.control.preview;
    window.clearTimeout(this.previewTimer);
    this.control = { ...this.control, preview: undefined };
    if (!preview) return this.snapshot();
    this.tell({ text: `Sent to ${preview.session}.`, tone: "success", speak: false });
    this.deliver(preview.session, preview.text, ["Read src/index.ts", "Ran pnpm test"], scriptedReply(preview.session, preview.text));
  }

  private approve(sessionName: string, requestId: string, confirmed: boolean): void {
    const pending = this.sessions.get(sessionName)?.pending;
    if (pending?.kind !== "permission" || pending.requestId !== requestId) return;
    if (pending.risk === "high" && !confirmed) {
      this.confirmation = () => this.approve(sessionName, requestId, true);
      this.control = { ...this.control, confirmation: `run ${pending.summary} for ${sessionName}` };
      this.snapshot();
      return this.tell({ text: `That command ${pending.riskReasons[0]}. Say confirm to run it.`, tone: "warning", speak: true });
    }
    this.confirmation = undefined;
    this.control = { ...this.control, confirmation: undefined };
    this.terminals.write(sessionName, `\r\n  \x1b[2mRan\x1b[0m ${pending.summary}\r\n`);
    if (requestId === "api-migrate") {
      this.deliver(sessionName, undefined, ["Ran pnpm backfill:orders"], undefined);
      window.setTimeout(() => this.ask(sessionName, { ...forcePushRequest, createdAt: Date.now() }), 6_000);
      return;
    }
    this.deliver(sessionName, undefined, [], "Pushed. The orders table and its backfill are on main.");
  }

  private runConfirmation(): void {
    const run = this.confirmation;
    if (!run) return this.tell({ text: "Nothing is waiting for a confirm.", tone: "info", speak: true });
    run();
  }

  private spawn(project: string, task: string | undefined): void {
    const name = this.sessions.has(project) ? `${project}-2` : project;
    this.sessions.set(name, newSession(name, `~/code/${project}`, Date.now()));
    this.control = { ...this.control, focusedSession: name };
    this.tell({ text: `Starting ${name}.`, tone: "success", speak: false });
    this.deliver(name, task, ["Read package.json", "Read src/index.ts"], task ? scriptedReply(name, task) : undefined);
  }

  // Shows the prompt, works through the lines, then ends the turn with the reply (if any).
  private deliver(sessionName: string, prompt: string | undefined, workingLines: string[], reply: string | undefined): void {
    if (prompt) {
      this.terminals.write(sessionName, `\r\n\x1b[7m ❯ ${prompt} \x1b[0m\r\n`);
      this.addActivity(sessionName, { kind: "prompt", text: prompt, at: Date.now() });
      this.update(sessionName, (session) => ({ ...session, lastPrompt: prompt }));
    }
    this.setState(sessionName, "working");
    workingLines.forEach((line, index) =>
      window.setTimeout(() => {
        this.terminals.write(sessionName, `  \x1b[2m${line}\x1b[0m\r\n`);
        const isFile = /^(Edit|Write) /.test(line);
        this.addActivity(sessionName, { kind: isFile ? "file" : "tool", text: line.replace(/^(Read|Edit|Write|Ran) /, ""), at: Date.now() });
      }, 700 * (index + 1)),
    );
    if (reply) window.setTimeout(() => this.finish(sessionName, reply), 700 * (workingLines.length + 1) + 600);
  }

  private finish(sessionName: string, message: string): void {
    this.terminals.write(sessionName, `\r\n\x1b[37m⏺\x1b[0m ${message}\r\n`);
    this.update(sessionName, (session) => ({ ...session, lastMessage: message, pending: undefined }));
    this.setState(sessionName, message.trim().endsWith("?") ? "asked" : "done");
  }

  private ask(sessionName: string, pending: NonNullable<SessionView["pending"]>): void {
    if (!this.sessions.has(sessionName)) return;
    const line = pending.kind === "permission" ? `Wants to run: ${pending.summary}` : pending.questions[0]?.question;
    this.terminals.write(sessionName, `\r\n  \x1b[33m${line}\x1b[0m\r\n`);
    this.update(sessionName, (session) => ({ ...session, pending }));
    this.setState(sessionName, pending.kind === "permission" ? "needs_permission" : "asked");
  }

  private playEvent(event: (typeof playgroundTimeline)[number]): void {
    if (event.kind === "finish") return this.finish(event.session, event.message);
    this.ask(event.session, { ...event.pending, createdAt: Date.now() });
  }

  private setState(sessionName: string, state: SessionState): void {
    const now = Date.now();
    this.update(sessionName, (session) => {
      const leavingWait = waitingStates.includes(session.state) && !waitingStates.includes(state);
      const waited = leavingWait ? session.waitedMillisecondsToday + (now - session.stateSince) : session.waitedMillisecondsToday;
      return { ...session, state, stateSince: now, waitedMillisecondsToday: waited, pending: state === "working" ? undefined : session.pending };
    });
  }

  private addActivity(sessionName: string, entry: ActivityEntry): void {
    this.update(sessionName, (session) => ({ ...session, activitySinceSeen: [...session.activitySinceSeen, entry] }));
  }

  private markSeen(sessionName: string): void {
    this.update(sessionName, (session) => ({ ...session, lastSeenAt: Date.now(), activitySinceSeen: [] }));
  }

  private update(sessionName: string, change: (session: SessionView) => SessionView): void {
    const session = this.sessions.get(sessionName);
    if (!session) return;
    this.sessions.set(sessionName, change(session));
    this.snapshot();
  }

  private tell(feedback: Feedback): void {
    this.emit({ type: "feedback", feedback });
  }

  private snapshot(): void {
    this.emit({ type: "snapshot", sessions: [...this.sessions.values()], recentlyClosed: [], projects: playgroundProjects, control: this.control, serverTime: Date.now() });
  }
}

function newSession(name: string, projectPath: string, now: number): SessionView {
  return { name, projectPath, projectName: name, agent: "claude", state: "idle", stateSince: now, createdAt: now, lastSeenAt: now, activitySinceSeen: [], waitedMillisecondsToday: 0 };
}
