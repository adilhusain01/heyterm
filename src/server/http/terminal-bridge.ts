// One browser terminal pane: a tmux client in a pseudo-terminal, streamed over a WebSocket.

import pty from "@lydell/node-pty";
import type { WebSocket } from "ws";
import type { TmuxServer } from "../tmux/tmux-server.ts";

type TerminalClientMessage = { type: "input"; data: string } | { type: "resize"; columns: number; rows: number };

export class TerminalBridge {
  constructor(private readonly tmux: TmuxServer) {}

  async connect(socket: WebSocket, sessionName: string, columns: number, rows: number): Promise<void> {
    if (!(await this.tmux.hasSession(sessionName))) {
      socket.close(4404, "no such session");
      return;
    }
    const { file, args } = this.tmux.attachCommand(sessionName);
    const terminal = pty.spawn(file, args, {
      name: "xterm-256color",
      cols: clampSize(columns, 80),
      rows: clampSize(rows, 24),
      env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
    });
    terminal.onData((data) => {
      if (socket.readyState === socket.OPEN) socket.send(data);
    });
    terminal.onExit(() => socket.close(1000, "session ended"));
    socket.on("message", (raw) => {
      const message = parseMessage(raw.toString());
      if (message?.type === "input") terminal.write(message.data);
      if (message?.type === "resize") terminal.resize(clampSize(message.columns, 80), clampSize(message.rows, 24));
    });
    // Closing the pane detaches this tmux client; the session itself keeps running.
    socket.on("close", () => terminal.kill());
  }
}

function clampSize(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 10 && value <= 500 ? Math.floor(value) : fallback;
}

function parseMessage(text: string): TerminalClientMessage | undefined {
  try {
    const message = JSON.parse(text) as TerminalClientMessage;
    return message.type === "input" || message.type === "resize" ? message : undefined;
  } catch {
    return undefined;
  }
}
