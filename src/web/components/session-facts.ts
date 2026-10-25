// What the sidebar's details card says about a session, open or closed, so sessions in the same
// folder can be told apart. Pure.

import type { AgentKind, SessionOrigin } from "../../shared/types.ts";

export interface SessionFactsInput {
  agent?: AgentKind;
  origin?: SessionOrigin;
  projectPath?: string;
  agentSessionId?: string;
  createdAt?: number;
  closedAt?: number;
}

export interface SessionFactRow {
  label: string;
  value: string;
  isCode?: boolean;
}

const agentNames: Record<AgentKind, string> = { claude: "Claude Code", codex: "Codex", gemini: "Gemini CLI", grok: "Grok Build", cursor: "Cursor" };

export class SessionFacts {
  static rows(session: SessionFactsInput, now: number): SessionFactRow[] {
    const rows: SessionFactRow[] = [];
    if (session.agent) rows.push({ label: "Agent", value: agentNames[session.agent] });
    if (session.origin) rows.push({ label: "Runs in", value: session.origin === "external" ? "Your own terminal" : "HeyTerm" });
    if (session.projectPath) rows.push({ label: "Folder", value: session.projectPath });
    if (session.createdAt) rows.push({ label: "Started", value: SessionFacts.when(session.createdAt, now) });
    if (session.closedAt) rows.push({ label: "Closed", value: SessionFacts.when(session.closedAt, now) });
    // The id the agent's own resume takes, for example claude --resume <id>.
    if (session.agentSessionId) rows.push({ label: "Session id", value: session.agentSessionId, isCode: true });
    return rows;
  }

  private static when(time: number, now: number): string {
    const moment = new Date(time);
    const clock = `${String(moment.getHours()).padStart(2, "0")}:${String(moment.getMinutes()).padStart(2, "0")}`;
    if (moment.toDateString() === new Date(now).toDateString()) return `today at ${clock}`;
    return `${moment.getDate()} ${moment.toLocaleString("en-GB", { month: "short" })} at ${clock}`;
  }
}
