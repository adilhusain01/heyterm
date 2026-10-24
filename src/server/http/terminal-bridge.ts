// One browser terminal pane: the session's terminal streamed over a WebSocket. Closing the pane
// only stops watching; the session keeps running.

import type { WebSocket } from "ws";
import type { TerminalHost } from "../terminals/terminal-host.ts";

type TerminalClientMessage = { type: "input"; data: string } | { type: "resize"; columns: number; rows: number };

// Typing and pastes are small; anything larger is not a person at a keyboard.
const largestInputBytes = 64 * 1024;

export class TerminalBridge {
  constructor(private readonly host: TerminalHost) {}

  connect(socket: WebSocket, sessionName: string, columns: number, rows: number): void {
    const viewer = {
      send: (data: string) => {
        if (socket.readyState === socket.OPEN) socket.send(data);
      },
      close: () => socket.close(1000, "session ended"),
    };
    const attachment = this.host.attach(sessionName, viewer, columns, rows);
    if (!attachment) {
      socket.close(4404, "no such session");
      return;
    }
    socket.on("message", (raw) => {
      const text = raw.toString();
      if (text.length > largestInputBytes) return;
      const message = parseMessage(text);
      if (message?.type === "input") attachment.write(message.data);
      if (message?.type === "resize") attachment.resize(message.columns, message.rows);
    });
    socket.on("close", () => attachment.detach());
  }
}

function parseMessage(text: string): TerminalClientMessage | undefined {
  try {
    const message = JSON.parse(text) as TerminalClientMessage;
    if (message.type === "input" && typeof message.data === "string") return message;
    if (message.type === "resize" && Number.isFinite(message.columns) && Number.isFinite(message.rows)) return message;
    return undefined;
  } catch {
    return undefined;
  }
}
