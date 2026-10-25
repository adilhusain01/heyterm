// Sessions saved to ~/.heyterm/state.json, so a restart of HeyTerm finds them again.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SessionView } from "../../shared/types.ts";

export interface SavedState {
  sessions: SessionView[];
  recentlyClosed: SessionView[];
}

// Sessions saved by older versions: every one was Claude Code, and its id was called claudeSessionId.
function upgraded(saved: SessionView & { claudeSessionId?: string }): SessionView {
  const { claudeSessionId, ...session } = saved;
  return { ...session, agent: session.agent ?? "claude", agentSessionId: session.agentSessionId ?? claudeSessionId };
}

export class StateStore {
  private readonly filePath: string;

  constructor(dataDirectory: string) {
    this.filePath = path.join(dataDirectory, "state.json");
  }

  async load(): Promise<SavedState> {
    const text = await readFile(this.filePath, "utf8").catch(() => "");
    if (!text) return { sessions: [], recentlyClosed: [] };
    try {
      const parsed = JSON.parse(text) as Partial<SavedState>;
      return { sessions: (parsed.sessions ?? []).map(upgraded), recentlyClosed: (parsed.recentlyClosed ?? []).map(upgraded) };
    } catch {
      return { sessions: [], recentlyClosed: [] };
    }
  }

  // Written to a temporary file first, so a crash never leaves half a file.
  async save(state: SavedState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    // A name of its own per save, so overlapping saves never write into the same temporary file.
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state), { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }
}
