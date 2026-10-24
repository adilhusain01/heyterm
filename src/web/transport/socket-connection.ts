// The real backend: WebSockets to the Callsign server on this Mac, reconnecting when it restarts.

import type { CallsignConnection, ConnectionHandlers, TerminalChannel } from "./connection.ts";
import type { ClientMessage, ServerMessage } from "../../shared/protocol.ts";

const longestReconnectDelayMilliseconds = 5_000;

export class SocketConnection implements CallsignConnection {
  private socket: WebSocket | undefined;
  private readonly unsent: string[] = [];

  connect(handlers: ConnectionHandlers): () => void {
    let stopped = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    const open = () => {
      handlers.onStatus("connecting");
      const socket = new WebSocket(socketUrl("/ws"));
      this.socket = socket;
      socket.onopen = () => {
        attempt = 0;
        handlers.onStatus("open");
        for (const text of this.unsent.splice(0)) socket.send(text);
      };
      socket.onmessage = (event) => handlers.onMessage(JSON.parse(String(event.data)) as ServerMessage);
      socket.onclose = () => {
        handlers.onStatus("closed");
        if (stopped) return;
        attempt += 1;
        retryTimer = window.setTimeout(open, Math.min(longestReconnectDelayMilliseconds, 250 * 2 ** attempt));
      };
    };
    open();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      this.socket?.close();
    };
  }

  send(message: ClientMessage): void {
    const text = JSON.stringify(message);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(text);
    else this.unsent.push(text);
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
  return `${protocol}//${window.location.host}${path}`;
}
