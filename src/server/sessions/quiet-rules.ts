// When a working session has been quiet long enough to say so: five minutes with no hook event,
// or ten minutes into one shell command (builds and test runs can take that long). Pure.

import type { QuietNotice, SessionView } from "../../shared/types.ts";

const quietAfterMilliseconds = 5 * 60_000;
const longCommandAfterMilliseconds = 10 * 60_000;

export class QuietRules {
  static verdict(session: SessionView, now: number): QuietNotice | undefined {
    if (session.state !== "working" || session.quiet) return undefined;
    if (session.runningCommand) {
      return now - session.runningCommand.since >= longCommandAfterMilliseconds ? { kind: "long_command", since: session.runningCommand.since } : undefined;
    }
    const lastHeardAt = session.lastActivityAt ?? session.stateSince;
    return now - lastHeardAt >= quietAfterMilliseconds ? { kind: "quiet", since: lastHeardAt } : undefined;
  }
}
