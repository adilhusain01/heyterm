// One browser terminal pane: the session's terminal streamed over a WebSocket. Closing the pane
// only stops watching; the session keeps running.

import type { WebSocket } from "ws";
import type { SuspendRescue } from "../terminals/suspend-rescue.ts";
import type { Terminals } from "../terminals/terminals.ts";
import { TerminalSizes, type PaneSize } from "./terminal-sizes.ts";

type TerminalClientMessage = { type: "input"; data: string } | { type: "resize"; columns: number; rows: number };

// Typing and pastes are small; anything larger is not a person at a keyboard.
const largestInputBytes = 64 * 1024;

// What the bridge needs for a session on another computer: a socket to that terminal there.
export interface RemoteTerminals {
  isRemote(sessionName: string): boolean;
  openTerminal(sessionName: string, columns: number, rows: number): WebSocket | undefined;
}

export class TerminalBridge {
  private readonly sizes = new TerminalSizes();

  constructor(
    private readonly host: Terminals,
    private readonly remote?: RemoteTerminals,
    private readonly suspendRescue?: SuspendRescue,
  ) {}

  // A pane opened by a tab in the background (a reconnect) leaves the terminal at the size of the pane in use.
  connect(socket: WebSocket, sessionName: string, columns: number, rows: number, { isInUse = true }: { isInUse?: boolean } = {}): void {
    if (this.remote?.isRemote(sessionName)) return this.connectRemote(socket, sessionName, columns, rows);
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
    const pane = { columns, rows };
    const resizeTo = (size: PaneSize | undefined) => size && attachment.resize(size.columns, size.rows);
    resizeTo(this.sizes.opened(sessionName, pane, { isInUse }));
    socket.on("message", (raw) => {
      const text = raw.toString();
      if (text.length > largestInputBytes) return;
      const message = parseMessage(text);
      if (message?.type === "input") {
        resizeTo(this.sizes.used(sessionName, pane));
        attachment.write(message.data);
        void this.suspendRescue?.afterInput(sessionName, message.data);
      }
      if (message?.type === "resize") {
        pane.columns = message.columns;
        pane.rows = message.rows;
        resizeTo(this.sizes.used(sessionName, pane));
      }
    });
    socket.on("close", () => {
      resizeTo(this.sizes.closed(sessionName, pane));
      attachment.detach();
    });
  }

  // A pane for a session on another computer talks to that computer's terminal through this one:
  // what is typed goes there, and its screen comes back, each closing when the other does.
  private connectRemote(socket: WebSocket, sessionName: string, columns: number, rows: number): void {
    const remoteSocket = this.remote!.openTerminal(sessionName, columns, rows);
    if (!remoteSocket) return socket.close(4404, "no such session");
    const waiting: string[] = [];
    remoteSocket.on("open", () => waiting.splice(0).forEach((text) => remoteSocket.send(text)));
    remoteSocket.on("message", (data) => {
      if (socket.readyState === socket.OPEN) socket.send(String(data));
    });
    remoteSocket.on("close", (code) => {
      // 4502 tells the page the other computer dropped, not this one (connection-health.ts).
      if (socket.readyState === socket.OPEN) socket.close(code === 1000 || code === 4404 ? code : 4502, "remote closed");
    });
    socket.on("message", (raw) => {
      const text = raw.toString();
      if (text.length > largestInputBytes || !parseMessage(text)) return;
      if (remoteSocket.readyState === remoteSocket.OPEN) remoteSocket.send(text);
      else waiting.push(text);
    });
    socket.on("close", () => remoteSocket.close());
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
