// Which of HeyTerm's terminals a running Claude belongs to, so a Claude started by hand in a terminal
// is that terminal and not a second session beside it. A Claude counts as the terminal's when its own
// process runs on the terminal's screen, or when something there names its conversation: on a server,
// claude-keep runs the session in Claude's daemon and shows it with "claude attach <id>". Pure.

import type { ClaudeSessionRecord } from "./claude-session-status.ts";

export interface TerminalProcesses {
  name: string;
  processes: Array<{ pid: number; args: string }>;
}

export interface TerminalLink {
  terminal: string;
  agentSessionId: string;
}

// Conversation ids, or their first eight characters, as claude attach and --resume take them.
const namedConversation = /claude\s+(?:attach|--resume|-r|--session-id)\s+([0-9a-f]{8}(?:-[0-9a-f-]{4,})?)/gi;

export class TerminalLinks {
  static find(terminals: TerminalProcesses[], records: ClaudeSessionRecord[]): TerminalLink[] {
    const links: TerminalLink[] = [];
    const linkedSessions = new Set<string>();
    for (const terminal of terminals) {
      const pids = new Set(terminal.processes.map((running) => running.pid));
      const named = terminal.processes.flatMap((running) => [...running.args.matchAll(namedConversation)].map((match) => match[1]!.toLowerCase()));
      const record = records.find((candidate) => !linkedSessions.has(candidate.sessionId) && (pids.has(candidate.pid) || named.some((id) => candidate.sessionId.toLowerCase().startsWith(id))));
      if (!record) continue;
      linkedSessions.add(record.sessionId);
      links.push({ terminal: terminal.name, agentSessionId: record.sessionId });
    }
    return links;
  }
}
