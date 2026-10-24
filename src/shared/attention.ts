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
    if (spoken.length === 1) return spoken[0]!.headline;
    const headlines = spoken.map((item) => item.headline.replace(/[.\s]+$/, "")).join(". ");
    return `${capitalize(countWord(spoken.length))} sessions need you. ${headlines}.`;
  }
}

function attentionItemFor(session: SessionView): AttentionItem | undefined {
  const base = { sessionName: session.name, since: session.stateSince };
  const pending = session.pending;
  switch (session.state) {
    case "needs_permission":
      if (pending?.kind !== "permission") return undefined;
      return { ...base, kind: "permission", headline: permissionHeadline(session.name, pending), requestId: pending.requestId };
    case "asked":
      if (session.blockedByTerminalDialog) return { ...base, kind: "question", headline: `${session.name} is waiting on a dialog in its terminal` };
      if (pending?.kind === "question") {
        return { ...base, kind: "question", headline: questionHeadline(session.name, pending), requestId: pending.requestId };
      }
      return { ...base, kind: "question", headline: `${session.name} asks: ${lastQuestionSentence(session.lastMessage ?? "")}` };
    case "needs_trust":
      return { ...base, kind: "trust", headline: `${session.name} needs you to trust its folder` };
    case "failed":
      return { ...base, kind: "failed", headline: `${session.name} stopped on an error` };
    case "done": {
      if (session.lastSeenAt >= session.stateSince) return undefined;
      const lead = firstSentence(session.lastMessage ?? "");
      return { ...base, kind: "finished", headline: lead ? `${session.name} finished: ${lead}` : `${session.name} finished` };
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
