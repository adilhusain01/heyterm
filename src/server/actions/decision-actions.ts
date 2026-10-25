// Answers, approvals and denials: the actions that release a hook HeyTerm is holding open.

import { SessionLifecycle } from "../sessions/session-lifecycle.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { AuditLog } from "../safety/audit-log.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { Feedback } from "../../shared/protocol.ts";

export interface DecisionContext {
  // The words that led here, for the audit log; "click" for a button.
  decidedBy: string;
}

export class DecisionActions {
  constructor(
    private readonly registry: SessionRegistry,
    private readonly heldRequests: HeldHookRequests,
    private readonly audit: AuditLog,
  ) {}

  async answer(sessionName: string, requestId: string, answers: Record<string, string>, context: DecisionContext): Promise<Feedback> {
    const session = this.registry.get(sessionName);
    if (session?.pending?.kind !== "question" || session.pending.requestId !== requestId) return closedRequest(sessionName);
    const updatedInput = { ...session.pending.toolInput, answers };
    if (!this.heldRequests.decide(requestId, { behavior: "allow", updatedInput })) return closedRequest(sessionName);
    const answerText = Object.values(answers).join(", ");
    this.settle(sessionName, `answered: ${answerText}`);
    await this.audit.record({ session: sessionName, decision: "answered", subject: answerText, decidedBy: context.decidedBy });
    return { text: `Answered ${sessionName}: ${answerText}`, tone: "success", speak: false };
  }

  async approve(sessionName: string, requestId: string, context: DecisionContext): Promise<Feedback> {
    const session = this.registry.get(sessionName);
    if (session?.pending?.kind !== "permission" || session.pending.requestId !== requestId) return closedRequest(sessionName);
    const { summary, risk } = session.pending;
    if (!this.heldRequests.decide(requestId, { behavior: "allow" })) return closedRequest(sessionName);
    this.settle(sessionName, `approved: ${summary}`);
    await this.audit.record({ session: sessionName, decision: "approved", subject: summary, decidedBy: context.decidedBy, risk });
    return { text: `Approved for ${sessionName}: ${summary}`, tone: "success", speak: false };
  }

  async deny(sessionName: string, requestId: string, reason: string | undefined, context: DecisionContext): Promise<Feedback> {
    const session = this.registry.get(sessionName);
    if (session?.pending?.kind !== "permission" || session.pending.requestId !== requestId) return closedRequest(sessionName);
    const { summary, risk } = session.pending;
    // Claude reads this message, so a reason lets it change course instead of stopping.
    const message = reason ? `The user said no: ${reason}` : "The user said no.";
    if (!this.heldRequests.decide(requestId, { behavior: "deny", message })) return closedRequest(sessionName);
    this.settle(sessionName, `denied: ${summary}${reason ? ` (${reason})` : ""}`);
    await this.audit.record({ session: sessionName, decision: "denied", subject: `${summary}${reason ? ` | ${reason}` : ""}`, decidedBy: context.decidedBy, risk });
    return { text: `Denied for ${sessionName}${reason ? `: ${reason}` : ""}`, tone: "info", speak: false };
  }

  // The session goes back to work at once; its PostToolUse hook confirms it a moment later.
  private settle(sessionName: string, decisionText: string): void {
    const now = Date.now();
    this.registry.update(sessionName, (session) => {
      const decided = SessionLifecycle.recordDecision(SessionLifecycle.markSeen(session, now), decisionText, now);
      return { ...decided, pending: undefined, state: "working", stateSince: now, waitedMillisecondsToday: session.waitedMillisecondsToday + (now - session.stateSince) };
    });
  }
}

function closedRequest(sessionName: string): Feedback {
  return { text: `${sessionName} is no longer waiting on that.`, tone: "warning", speak: true };
}
