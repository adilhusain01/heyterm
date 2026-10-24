// What needs the user, in what order, and how it is said out loud.

import { firstSentence, lastQuestionSentence } from "./message-text.ts";
import type { AnnouncementMode, AttentionItem, AttentionKind, PendingPermission, PendingQuestion, SessionView } from "./types.ts";

const kindOrder: AttentionKind[] = ["permission", "question", "trust", "failed", "finished"];
const kindsSpokenInQuietMode: AttentionKind[] = ["permission", "question"];

export class AttentionQueue {
  static build(sessions: SessionView[]): AttentionItem[] {
    const items = sessions.map(attentionItemFor).filter((item): item is AttentionItem => item !== undefined);
    return items.sort((left, right) => kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind) || left.since - right.since);
  }
}

export class AnnouncementText {
  static forItems(items: AttentionItem[], mode: AnnouncementMode): string | undefined {
    if (mode === "mute") return undefined;
    const spoken = mode === "quiet" ? items.filter((item) => kindsSpokenInQuietMode.includes(item.kind)) : items;
    if (spoken.length === 0) return undefined;
    if (spoken.length === 1) return spoken[0]!.spoken;
    return `${capitalize(countWord(spoken.length))} sessions need you. ${spoken.map((item) => item.spoken).join(" ")}`;
  }
}

function attentionItemFor(session: SessionView): AttentionItem | undefined {
  const base = { sessionName: session.name, since: session.stateSince };
  const pending = session.pending;
  switch (session.state) {
    case "needs_permission":
      if (pending?.kind !== "permission") return undefined;
      return { ...base, kind: "permission", headline: permissionHeadline(session.name, pending), spoken: permissionSpoken(session.name, pending), requestId: pending.requestId };
    case "asked":
      if (session.blockedByTerminalDialog) {
        const headline = `${session.name} is waiting on a dialog in its terminal`;
        return { ...base, kind: "question", headline, spoken: `${headline}.` };
      }
      if (pending?.kind === "question") {
        const headline = questionHeadline(session.name, pending);
        return { ...base, kind: "question", headline, spoken: endSentence(headline), requestId: pending.requestId };
      }
      const headline = `${session.name} asks: ${lastQuestionSentence(session.lastMessage ?? "")}`;
      return { ...base, kind: "question", headline, spoken: endSentence(headline) };
    case "needs_trust":
      if (session.trustSubject === "hooks") {
        return { ...base, kind: "trust", headline: `${session.name} asks you to trust Callsign's hooks`, spoken: `${session.name} asks you to trust Callsign's hooks. Say trust it.` };
      }
      return { ...base, kind: "trust", headline: `${session.name} needs you to trust its folder`, spoken: `${session.name} needs you to trust its folder. Say trust it.` };
    case "failed":
      return { ...base, kind: "failed", headline: `${session.name} stopped on an error`, spoken: `${session.name} stopped on an error.` };
    case "done": {
      if (session.lastSeenAt >= session.stateSince) return undefined;
      const lead = firstSentence(session.lastMessage ?? "");
      return { ...base, kind: "finished", headline: lead ? `${session.name} finished: ${lead}` : `${session.name} finished`, spoken: `${session.name} is done.` };
    }
    default:
      return undefined;
  }
}

function permissionHeadline(sessionName: string, pending: PendingPermission): string {
  if (pending.toolName === "Bash") return `${sessionName} wants to run ${pending.summary}`;
  if (/^(edit|fetch|use) /.test(pending.summary)) return `${sessionName} wants to ${pending.summary}`;
  return `${sessionName} wants to use ${pending.summary}`;
}

const editingTools = ["Edit", "Write", "MultiEdit", "NotebookEdit"];

function permissionSpoken(sessionName: string, pending: PendingPermission): string {
  if (pending.risk === "high") {
    const reason = pending.riskReasons[0] ?? "is risky";
    if (pending.toolName === "Bash") return `${sessionName} wants to run a command that ${reason}. Say approve or deny.`;
    return `${sessionName} wants permission for something that ${reason}. Say approve or deny.`;
  }
  if (pending.toolName === "Bash") return `${sessionName} wants to run a command. Say approve or deny.`;
  if (editingTools.includes(pending.toolName)) return `${sessionName} wants to edit a file. Say approve or deny.`;
  return `${sessionName} wants to use a tool. Say approve or deny.`;
}

function endSentence(text: string): string {
  return /[.?!]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

function questionHeadline(sessionName: string, pending: PendingQuestion): string {
  const [first, ...rest] = pending.questions;
  if (!first) return `${sessionName} has a question`;
  const choices = first.options.map((option) => option.label).join(" or ");
  const more = rest.length > 0 ? `, and ${countWord(rest.length)} more` : "";
  return `${sessionName} asks: ${first.question} ${choices}${more}`;
}

const countWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function countWord(count: number): string {
  return countWords[count] ?? String(count);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
