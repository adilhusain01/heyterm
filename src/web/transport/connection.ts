// What the UI needs from a backend. The real one talks to the local server; the playground
// for judges runs simulated agents behind the same interface.

import type { ClientMessage, ServerMessage } from "../../shared/protocol.ts";

// "needs_token": the page was opened without the secret the heyterm command gives it.
export type ConnectionStatus = "connecting" | "open" | "closed" | "needs_token";

export interface ConnectionHandlers {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
}

export interface TerminalChannel {
  onData: (listener: (data: string) => void) => void;
  // The session ended or is gone; nothing more will come.
  onClose: (listener: () => void) => void;
  // The connection dropped and is being tried again. Backends that cannot drop leave these out.
  onConnectionLost?: (listener: () => void) => void;
  // The connection is back and the whole screen follows: clear the old copy first.
  onRedraw?: (listener: () => void) => void;
  write: (data: string) => void;
  resize: (columns: number, rows: number) => void;
  close: () => void;
}

export interface HeyTermConnection {
  // Returns a function that disconnects.
  connect: (handlers: ConnectionHandlers) => () => void;
  send: (message: ClientMessage) => void;
  openTerminal: (sessionName: string, columns: number, rows: number) => TerminalChannel;
}
