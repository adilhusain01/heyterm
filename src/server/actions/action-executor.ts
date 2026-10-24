// Turns what the user said into what happens: routes the utterance, then carries out the action.

import { EventEmitter } from "node:events";
import { DecisionActions } from "./decision-actions.ts";
import { PendingControls } from "./pending-controls.ts";
import { UtteranceLimits } from "./utterance-limits.ts";
import { SessionActions } from "./session-actions.ts";
import { AttentionQueue } from "../../shared/attention.ts";
import { acceptsText, type FastPathRouter } from "../router/fast-path-router.ts";
import { ConductorRouting } from "../conductor/conductor-rules.ts";
import type { Assistant } from "../conductor/assistant.ts";
import type { Situation } from "../conductor/conductor-prompt.ts";
import type { ProjectCatalog } from "../projects/project-catalog.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { SessionDigest } from "../../shared/catch-up.ts";
import type { ControlState, Feedback, InputSource } from "../../shared/protocol.ts";
import type { AnnouncementMode, RouterAction, RoutingContext } from "../../shared/types.ts";

interface ExecutorEvents {
  changed: [];
  feedback: [Feedback];
  focus: [string];
  catchUp: [SessionDigest[]];
}

export class ActionExecutor extends EventEmitter<ExecutorEvents> {
  private mode: AnnouncementMode = "speak";
  private focusedSession: string | undefined;
  private routing = false;
  private lastHeard: string | undefined;
  private readonly controls = new PendingControls(() => this.emit("changed"));
  private assistant: Assistant | undefined;

  constructor(
    private readonly registry: SessionRegistry,
    private readonly projects: ProjectCatalog,
    private readonly fastPath: FastPathRouter,
    private readonly decisions: DecisionActions,
    private readonly sessionActions: SessionActions,
  ) {
    super();
  }

  controlState(): ControlState {
    return { ...this.controls.view(), mode: this.mode, focusedSession: this.focusedSession, routing: this.routing, lastHeard: this.lastHeard };
  }

  setFocus(sessionName: string): void {
    if (!this.registry.get(sessionName)) return;
    this.focusedSession = sessionName;
    this.sessionActions.markSeen(sessionName);
    this.emit("focus", sessionName);
    this.emit("changed");
  }

  // The assistant is made after the executor, because its tools act through the executor.
  attachAssistant(assistant: Assistant): void {
    this.assistant = assistant;
    assistant.on("thinking", (thinking) => this.setRouting(thinking));
  }

  async situation(): Promise<Situation> {
    return {
      sessions: this.registry.list(),
      focusedSession: this.focusedSession,
      projectNames: (await this.projects.list()).map((project) => project.name),
      recentlyClosedNames: this.registry.recentlyClosedSessions().map((session) => session.name),
    };
  }

  currentMode(): AnnouncementMode {
    return this.mode;
  }

  async handleUtterance(text: string, source: InputSource, focusOverride?: string): Promise<void> {
    const checked = UtteranceLimits.check(text);
    if (!checked.ok) {
      if (checked.reason === "too_long") this.tell({ text: "That was far longer than speech, so I left it. Say it in a sentence or two.", tone: "warning", speak: true });
      return;
    }
    const utterance = checked.utterance;
    this.lastHeard = utterance;
    this.emit("changed");
    const context = await this.routingContext(focusOverride);
    const action = this.fastPath.route(utterance, context);
    // Anything that is not a plain decision or a session named outright goes to the assistant.
    if (!action || !ConductorRouting.handledInstantly(action, { confirmationWaiting: this.controls.view().confirmation !== undefined })) {
      if (this.assistant) return this.assistant.hear(utterance);
      return this.tell({ text: "I did not catch what to do.", tone: "warning", speak: true });
    }
    this.assistant?.recordInstant(utterance);
    // A new command sends a waiting preview first, unless the command is about the preview.
    if (this.controls.preview && action.type !== "cancel" && action.type !== "send_now") await this.sendPreviewNow();
    await this.perform(action, source === "voice" ? utterance : "keyboard", utterance);
  }

  async perform(action: RouterAction, decidedBy: string, utterance = ""): Promise<void> {
    const decision = { decidedBy };
    switch (action.type) {
      case "send":
        return this.send(action.session, action.text, action.needsPreview);
      case "send_now":
        return this.sendPreviewNow();
      case "cancel":
        this.controls.clearAll();
        return this.tell({ text: "Cancelled.", tone: "info", speak: false });
      case "answer":
        return this.tell(await this.decisions.answer(action.session, action.requestId, action.answers, decision));
      case "approve":
        return this.approve(action.session, action.requestId, action.confirmed, decidedBy);
      case "deny":
        return this.tell(await this.decisions.deny(action.session, action.requestId, action.reason, decision));
      case "confirm":
        return this.confirm();
      case "close":
        return this.close(action.session, action.confirmed);
      case "choose":
        return this.choose(action.index);
      case "clarify":
        this.controls.askToClarify({ question: action.question, options: action.options }, utterance);
        return this.tell({ text: `${action.question} ${action.options.join(" or ")}?`, tone: "info", speak: true });
      case "mode":
        this.mode = action.mode;
        this.emit("changed");
        return this.tell({ text: modeFeedback[action.mode], tone: "info", speak: action.mode !== "mute" });
      case "focus":
        this.setFocus(action.session);
        return;
      case "catch_up":
        return this.catchUp(action.session);
      case "unknown":
        return this.tell({ text: action.reason, tone: "warning", speak: true });
      default:
        return this.tell(await this.sessionActions.perform(action, (sessionName) => this.setFocus(sessionName)));
    }
  }

  private async send(sessionName: string, text: string, needsPreview: boolean): Promise<void> {
    const session = this.registry.get(sessionName);
    if (!session) return this.tell({ text: `There is no session called ${sessionName}.`, tone: "warning", speak: true });
    if (session.origin === "external") return this.tell({ text: outsideSessionReason(sessionName), tone: "warning", speak: true });
    if (session.blockedByTerminalDialog) return this.tell({ text: `${sessionName} is showing a dialog in its terminal. Answer it there.`, tone: "warning", speak: true });
    if (!acceptsText(session)) return this.tell({ text: blockedReason(sessionName, session.state), tone: "warning", speak: true });
    if (!needsPreview) return this.tell(await this.sessionActions.deliver(sessionName, text));
    this.controls.startPreview({ session: sessionName, text }, () => void this.sendPreviewNow());
  }

  private async sendPreviewNow(): Promise<void> {
    const preview = this.controls.takePreview();
    if (preview) this.tell(await this.sessionActions.deliver(preview.session, preview.text));
  }

  // The assistant approves on the developer's words; the agent asked, so its answer stands.
  async approveForAssistant(sessionName: string, requestId: string): Promise<string> {
    return (await this.decisions.approve(sessionName, requestId, { decidedBy: "the assistant, on the developer's words" })).text;
  }

  // Waits for the developer's yes or no to something the assistant asked, as Claude Code itself would
  // have asked them. No answer in two minutes counts as no.
  waitForSpokenApproval(description: string, waitMilliseconds = 120_000): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.controls.dropConfirmation();
        resolve(false);
      }, waitMilliseconds);
      this.controls.awaitConfirmation(
        description,
        async () => {
          clearTimeout(timer);
          resolve(true);
        },
        () => {
          clearTimeout(timer);
          resolve(false);
        },
      );
    });
  }

  private async approve(sessionName: string, requestId: string, confirmed: boolean, decidedBy: string): Promise<void> {
    // The agent asked, so the developer's yes is enough: Callsign adds no gate of its own.
    this.tell(await this.decisions.approve(sessionName, requestId, { decidedBy }));
  }

  private async close(sessionName: string, confirmed: boolean): Promise<void> {
    const session = this.registry.get(sessionName);
    if (!session) return this.tell({ text: `There is no session called ${sessionName}.`, tone: "warning", speak: true });
    if (session.origin === "external") return this.tell({ text: `${sessionName} runs in your own terminal. Close it there.`, tone: "info", speak: true });
    if (!confirmed) {
      const reason = session.state === "working" ? "is still working" : (await this.sessionActions.hasUncommittedChanges(sessionName)) ? "has uncommitted changes" : undefined;
      if (reason) {
        this.controls.awaitConfirmation(`close ${sessionName}`, () => this.close(sessionName, true));
        return this.tell({ text: `${sessionName} ${reason}. Say confirm to close it.`, tone: "warning", speak: true });
      }
    }
    this.controls.dropConfirmation();
    if (this.focusedSession === sessionName) this.focusedSession = undefined;
    this.tell(await this.sessionActions.close(sessionName));
  }

  private async confirm(): Promise<void> {
    const confirmed = this.controls.takeConfirmation();
    if (!confirmed) return this.tell({ text: "Nothing is waiting for a confirm.", tone: "info", speak: true });
    await confirmed();
  }

  private async choose(index: number): Promise<void> {
    const clarify = this.controls.takeClarify();
    const chosen = clarify?.options[index];
    if (!clarify || !chosen) return this.tell({ text: "There is nothing to choose from.", tone: "info", speak: true });
    await this.handleUtterance(clarify.utterance, "voice", chosen);
  }

  private async catchUp(sessionName: string | undefined): Promise<void> {
    const digests = this.sessionActions.catchUp(sessionName);
    this.emit("catchUp", digests);
    const spoken = digests.length === 0 ? "Nothing new since you last looked." : digests.slice(0, 4).map((digest) => digest.spoken).join(" ");
    this.tell({ text: spoken, tone: "info", speak: true });
  }

  private async routingContext(focusOverride?: string): Promise<RoutingContext> {
    const sessions = this.registry.list();
    const projectNames = (await this.projects.list()).map((project) => project.name);
    return {
      sessions,
      projectNames,
      attentionHead: focusOverride ? undefined : AttentionQueue.build(sessions)[0],
      focusedSession: focusOverride ?? this.focusedSession,
      hasPendingPreview: this.controls.preview !== undefined,
      pendingClarifyOptions: this.controls.clarify?.options,
      recentlyClosedNames: this.registry.recentlyClosedSessions().map((session) => session.name),
      hasPendingConfirmation: this.controls.view().confirmation !== undefined,
    };
  }

  private setRouting(routing: boolean): void {
    this.routing = routing;
    this.emit("changed");
  }

  private tell(feedback: Feedback): void {
    this.emit("feedback", feedback);
  }
}

const modeFeedback: Record<AnnouncementMode, string> = {
  speak: "I'll tell you about everything.",
  quiet: "Quiet mode. I'll only speak for permissions and questions.",
  mute: "Muted. Sounds only.",
};

function outsideSessionReason(sessionName: string): string {
  return `${sessionName} runs in your own terminal, so Callsign can't type into it. Approvals, answers and alerts still work here.`;
}

function blockedReason(sessionName: string, state: string): string {
  if (state === "needs_permission") return `${sessionName} is waiting on a permission. Say approve or deny.`;
  if (state === "needs_trust") return `${sessionName} is waiting for you to trust its folder. Say trust it.`;
  if (state === "starting") return `${sessionName} is still starting.`;
  if (state === "stopped") return `${sessionName} has stopped. Say bring back ${sessionName}.`;
  return `${sessionName} is showing a question. Answer it first.`;
}
