// What the server needs from whatever runs its terminals: TerminalHost in this process, or
// KeptTerminals, which asks the terminal keeper that outlives the server.

import type { NewTerminalSession, TerminalAttachment, TerminalViewer } from "./terminal-host.ts";

export interface Terminals {
  on(event: "exit", listener: (name: string) => void): unknown;
  listSessions(): Array<{ name: string }>;
  hasSession(name: string): boolean;
  createSession(session: NewTerminalSession): void;
  renameSession(currentName: string, newName: string): void;
  killSession(name: string): void;
  pasteText(name: string, text: string): void;
  pressKeys(name: string, keys: string[]): void;
  foregroundProgram(name: string): string | undefined | Promise<string | undefined>;
  captureScreen(name: string): Promise<string>;
  attach(name: string, viewer: TerminalViewer, columns: number, rows: number): TerminalAttachment | undefined;
  shutdown(): void;
}
