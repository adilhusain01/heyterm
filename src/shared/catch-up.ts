// "Catch me up": what each session did since the user last looked at it.

import { firstSentence, lastQuestionSentence } from "./message-text.ts";
import type { SessionState, SessionView } from "./types.ts";

export interface SessionDigest {
  sessionName: string;
  state: SessionState;
  spoken: string;
  prompts: string[];
  commands: string[];
  changedFiles: string[];
  lead?: string;
}

const statePhrases: Record<SessionState, string> = {
  starting: "is starting",
  idle: "is idle",
  working: "is working",
  needs_permission: "needs a permission",
  asked: "has a question",
  needs_trust: "needs you to trust its folder",
  done: "finished",
  failed: "failed",
  stopped: "has stopped",
};

const stateOrder: SessionState[] = ["needs_permission", "asked", "needs_trust", "failed", "done", "working", "idle", "starting", "stopped"];
const statesWorthMentioningWithoutActivity: SessionState[] = ["needs_permission", "asked", "needs_trust", "failed"];

export class CatchUpDigest {
  static forSession(session: SessionView): SessionDigest {
    const activity = session.activitySinceSeen;
    const prompts = activity.filter((entry) => entry.kind === "prompt").map((entry) => entry.text);
    const commands = activity.filter((entry) => entry.kind === "tool").map((entry) => entry.text);
    const changedFiles = [...new Set(activity.filter((entry) => entry.kind === "file").map((entry) => entry.text))];
    const lead = CatchUpDigest.leadFor(session);
    const parts = [`${session.name} ${statePhrases[session.state]}.`];
    if (activity.length === 0) {
      parts.push("Nothing new since you looked.");
    } else {
      const counts = [plural(commands.length, "command"), changedFiles.length > 0 ? `${plural(changedFiles.length, "file")} changed` : ""];
      const countText = counts.filter((text) => text && !text.startsWith("0 ")).join(", ");
      if (countText) parts.push(`${countText}.`);
    }
    if (lead) parts.push(lead);
    return { sessionName: session.name, state: session.state, spoken: parts.join(" "), prompts, commands, changedFiles, lead };
  }

  static forAll(sessions: SessionView[]): SessionDigest[] {
    const worthMentioning = sessions.filter(
      (session) => session.activitySinceSeen.length > 0 || statesWorthMentioningWithoutActivity.includes(session.state),
    );
    return worthMentioning
      .sort((left, right) => stateOrder.indexOf(left.state) - stateOrder.indexOf(right.state))
      .map((session) => CatchUpDigest.forSession(session));
  }

  private static leadFor(session: SessionView): string | undefined {
    if (!session.lastMessage) return undefined;
    if (session.state === "done") return firstSentence(session.lastMessage);
    if (session.state === "asked" && !session.pending) return lastQuestionSentence(session.lastMessage);
    return undefined;
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
