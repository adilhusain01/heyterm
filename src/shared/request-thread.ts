// Requests as part of the conversation: a session's request is a line in the chat, it stays
// answerable while the session still waits on it, and a clicked answer shows up as the user's reply.

import { AttentionQueue } from "./attention.ts";
import type { ConversationEntry, ConversationRequest } from "./protocol.ts";
import type { AttentionItem, AttentionKind, RouterAction, SessionView } from "./types.ts";

// The kinds that wait on a decision. Finished work is news, told as an event.
const decisionKinds: AttentionKind[] = ["permission", "question", "trust", "failed"];

export class RequestThread {
  static isDecision(kind: AttentionKind): boolean {
    return decisionKinds.includes(kind);
  }

  // The same session asking the same kind of thing since the same moment is the same request.
  static isStillWaiting(request: ConversationRequest, sessions: SessionView[]): boolean {
    return AttentionQueue.build(sessions).some((item) => item.sessionName === request.session && item.kind === request.kind && item.since === request.since);
  }

  static waitingDecisions(sessions: SessionView[]): AttentionItem[] {
    return AttentionQueue.build(sessions).filter((item) => RequestThread.isDecision(item.kind));
  }

  // Requests the conversation has no line for, so they can still be shown and answered.
  static waitingWithoutEntry(entries: ConversationEntry[], sessions: SessionView[]): AttentionItem[] {
    const told = entries.flatMap((entry) => (entry.request ? [entry.request] : []));
    return RequestThread.waitingDecisions(sessions).filter((item) => !told.some((request) => request.session === item.sessionName && request.kind === item.kind && request.since === item.since));
  }

  // A click on a request's button, put the way the user would have said it.
  static replyWords(action: RouterAction): string | undefined {
    switch (action.type) {
      case "approve":
        return `Approve ${action.session}`;
      case "deny":
        return `Deny ${action.session}`;
      case "trust":
        return `Trust ${action.session}`;
      case "answer":
        return `${action.session}: ${Object.values(action.answers).join(", ")}`;
      default:
        return undefined;
    }
  }
}
