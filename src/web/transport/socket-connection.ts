// The real backend: WebSockets to the HeyTerm server on this Mac, reconnecting when it restarts.

import { ensurePageToken, pageToken } from "./page-token.ts";
import { UnsentMessages } from "./unsent-messages.ts";
import type { HeyTermConnection, ConnectionHandlers, TerminalChannel } from "./connection.ts";
import type { ClientMessage, ServerMessage } from "../../shared/protocol.ts";

const longestReconnectDelayMilliseconds = 5_000;

export class SocketConnection implements HeyTermConnection {
  private socket: WebSocket | undefined;
  private readonly unsent = new UnsentMessages();

  connect(handlers: ConnectionHandlers): () => void {
    let stopped = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    const open = async () => {
      if (!(await ensurePageToken())) return handlers.onStatus("needs_token");
      if (stopped) return;
      handlers.onStatus("connecting");
      const socket = new WebSocket(socketUrl("/ws"));
      this.socket = socket;
      socket.onopen = () => {
        attempt = 0;
        handlers.onStatus("open");
        const { fresh, droppedCount } = this.unsent.takeFresh(Date.now());
        for (const text of fresh) socket.send(text);
        if (droppedCount > 0) {
          const text = droppedCount === 1 ? "One thing you said or clicked while HeyTerm was away was not sent. Say it again if you still want it." : `${droppedCount} things you said or clicked while HeyTerm was away were not sent. Say them again if you still want them.`;
          handlers.onMessage({ type: "feedback", feedback: { text, tone: "warning", speak: false } });
        }
      };
      socket.onmessage = (event) => handlers.onMessage(JSON.parse(String(event.data)) as ServerMessage);
      socket.onclose = () => {
        handlers.onStatus("closed");
        if (stopped) return;
        attempt += 1;
        retryTimer = window.setTimeout(() => void open(), Math.min(longestReconnectDelayMilliseconds, 250 * 2 ** attempt));
      };
    };
    void open();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      this.socket?.close();
    };
  }

  send(message: ClientMessage): void {
    const text = JSON.stringify(message);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(text);
    else this.unsent.add(text, Date.now());
  }

  openTerminal(sessionName: string, columns: number, rows: number): TerminalChannel {
    const query = new URLSearchParams({ session: sessionName, columns: String(columns), rows: String(rows) });
    const socket = new WebSocket(socketUrl(`/pty?${query.toString()}`));
    const dataListeners: Array<(data: string) => void> = [];
    const closeListeners: Array<() => void> = [];
    const pending: string[] = [];
    const sendWhenOpen = (text: string) => (socket.readyState === WebSocket.OPEN ? socket.send(text) : pending.push(text));
    socket.onopen = () => pending.splice(0).forEach((text) => socket.send(text));
    socket.onmessage = (event) => dataListeners.forEach((listener) => listener(String(event.data)));
    socket.onclose = () => closeListeners.forEach((listener) => listener());
    return {
      onData: (listener) => dataListeners.push(listener),
      onClose: (listener) => closeListeners.push(listener),
      write: (data) => sendWhenOpen(JSON.stringify({ type: "input", data })),
      resize: (columns, rows) => sendWhenOpen(JSON.stringify({ type: "resize", columns, rows })),
      close: () => socket.close(),
    };
  }
}

function socketUrl(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const separator = path.includes("?") ? "&" : "?";
  return `${protocol}//${window.location.host}${path}${separator}token=${encodeURIComponent(pageToken() ?? "")}`;
}
