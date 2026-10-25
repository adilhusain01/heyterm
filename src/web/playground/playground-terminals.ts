// The simulated agents' terminal output. Each session keeps what it wrote, so a pane opened later
// shows the whole story.

export class PlaygroundTerminals {
  private readonly written = new Map<string, string>();
  private readonly listeners = new Map<string, Set<(data: string) => void>>();

  write(sessionName: string, data: string): void {
    this.written.set(sessionName, (this.written.get(sessionName) ?? banner(sessionName)) + data);
    for (const listener of this.listeners.get(sessionName) ?? []) listener(data);
  }

  subscribe(sessionName: string, listener: (data: string) => void): () => void {
    listener(this.written.get(sessionName) ?? banner(sessionName));
    const listeners = this.listeners.get(sessionName) ?? new Set();
    listeners.add(listener);
    this.listeners.set(sessionName, listeners);
    return () => listeners.delete(listener);
  }
}

function banner(sessionName: string): string {
  return `\x1b[2mClaude Code, simulated for the HeyTerm playground · ${sessionName}\x1b[0m\r\n`;
}
