// How a closed session comes back, and when a session has ended without Callsign closing it.

import type { SessionView } from "../../shared/types.ts";

// A session that is still starting gets this long for its terminal to appear.
const startingGraceMilliseconds = 10_000;

export class SessionResume {
  // `claude --resume <id>` quits with "No conversation found" when Claude never saved the
  // conversation, which happens when the session never got a message. Those start fresh.
  static claudeArguments(
    closed: Pick<SessionView, "claudeSessionId" | "transcriptPath" | "lastPrompt">,
    { transcriptExists }: { transcriptExists: boolean | undefined },
  ): string {
    if (!closed.claudeSessionId) return "";
    const conversationSaved = transcriptExists ?? closed.lastPrompt !== undefined;
    return conversationSaved ? `--resume ${closed.claudeSessionId}` : "";
  }

  static endedOnItsOwn(session: Pick<SessionView, "state" | "stateSince" | "origin">, { terminalRunning, now }: { terminalRunning: boolean; now: number }): boolean {
    if (session.origin === "external" || terminalRunning) return false;
    if (session.state === "starting" && now - session.stateSince < startingGraceMilliseconds) return false;
    return true;
  }
}
