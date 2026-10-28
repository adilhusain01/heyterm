// What the server and the terminal keeper say to each other. The keeper owns the terminals; the
// server asks it to start, type into, read and end them, and pages watch them through it.

import type { NewTerminalSession } from "../terminals/terminal-host.ts";

// Raised when a message changes shape, so a keeper and a server from different builds notice.
export const keeperProtocolVersion = 1;

export type ServerMessage =
  | { type: "create"; requestId: number; session: NewTerminalSession }
  | { type: "rename"; currentName: string; newName: string }
  | { type: "kill"; name: string }
  | { type: "paste"; name: string; text: string }
  | { type: "keys"; name: string; keys: string[] }
  | { type: "foreground"; requestId: number; name: string }
  | { type: "capture"; requestId: number; name: string }
  | { type: "processes"; requestId: number; name: string }
  | { type: "attach"; attachId: number; name: string; columns: number; rows: number }
  | { type: "write"; attachId: number; data: string }
  | { type: "resize"; attachId: number; columns: number; rows: number }
  | { type: "detach"; attachId: number }
  // HeyTerm is stopping for good: every terminal ends.
  | { type: "end_all" }
  // The server is up and answering pages, so a later exit is a crash to recover from.
  | { type: "listening" };

export type KeeperMessage =
  // Sent first: the terminals still running, which a server that just restarted takes over.
  | { type: "hello"; protocolVersion: number; names: string[] }
  | { type: "reply"; requestId: number; result?: string; error?: string }
  | { type: "names"; names: string[] }
  | { type: "data"; attachId: number; data: string }
  | { type: "viewer_closed"; attachId: number }
  | { type: "exit"; name: string }
  // The server's code changed on disk: the server is asked to restart itself into it.
  | { type: "please_restart" };
