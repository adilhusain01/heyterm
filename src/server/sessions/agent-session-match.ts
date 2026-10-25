// Which HeyTerm session a Grok or Cursor hook event belongs to. Those agents take hooks only from
// global files, so their events arrive from every session on the computer. HeyTerm keeps the ones
// from sessions it started: Grok's by the session id HeyTerm gave it at launch, Cursor's by the
// conversation id it reports first, claimed for the newest session HeyTerm started in that folder. Pure.

import path from "node:path";
import type { AgentKind, SessionView } from "../../shared/types.ts";

export interface AgentSessionFound {
  session: SessionView;
  // True when the session takes this id now, on the agent's first event.
  claimsId: boolean;
}

export class AgentSessionMatch {
  static find(sessions: SessionView[], agent: AgentKind, agentSessionId: string, workingDirectory: string): AgentSessionFound | undefined {
    const ours = sessions.filter((session) => session.origin !== "external" && session.agent === agent);
    const known = ours.find((session) => session.agentSessionId === agentSessionId);
    if (known) return { session: known, claimsId: false };
    const folder = path.resolve(workingDirectory || "/");
    const unclaimed = ours.filter((session) => !session.agentSessionId && path.resolve(session.projectPath) === folder).sort((left, right) => right.createdAt - left.createdAt);
    return unclaimed[0] ? { session: unclaimed[0], claimsId: true } : undefined;
  }
}
