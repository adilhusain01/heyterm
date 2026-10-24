// What the UI needs from a backend. The real one talks to the local server; the playground
// for judges runs simulated agents behind the same interface.

import type { ClientMessage, ServerMessage } from "../../shared/protocol.ts";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface ConnectionHandlers {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
}

export interface TerminalChannel {
  onData: (listener: (data: string) => void) => void;
  onClose: (listener: () => void) => void;
  write: (data: string) => void;
  resize: (columns: number, rows: number) => void;
  close: () => void;
}

export interface CallsignConnection {
  // Returns a function that disconnects.
  connect: (handlers: ConnectionHandlers) => () => void;
  send: (message: ClientMessage) => void;
  openTerminal: (sessionName: string, columns: number, rows: number) => TerminalChannel;
}
