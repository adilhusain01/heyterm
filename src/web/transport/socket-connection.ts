// The real backend: WebSockets to the HeyTerm server on this Mac. Every socket reconnects by itself:
// when HeyTerm restarts, when the browser drops it, and when it only looks open after the Mac slept
// (rules in connection-health.ts). A pane that reconnects is redrawn from the server's screen.

import { ConnectionHealth, type PaneLossCause } from "./connection-health.ts";
import { ensurePageToken, pageToken } from "./page-token.ts";
import { UnsentMessages } from "./unsent-messages.ts";
import type { HeyTermConnection, ConnectionHandlers, TerminalChannel } from "./connection.ts";
import type { ClientMessage, ServerMessage } from "../../shared/protocol.ts";

export class SocketConnection implements HeyTermConnection {
  private socket: WebSocket | undefined;
  private readonly unsent = new UnsentMessages();
  // Panes open now, so a connection found dead can take theirs along.
  private readonly terminals = new Set<ReconnectingTerminal>();

  connect(handlers: ConnectionHandlers): () => void {
    let stopped = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    let lastMessageAt = Date.now();
    let askedAt: number | undefined;

    const open = async () => {
      if (!(await ensurePageToken())) return handlers.onStatus("needs_token");
      if (stopped) return;
      handlers.onStatus("connecting");
      const socket = new WebSocket(socketUrl("/ws"));
      this.socket = socket;
      socket.onopen = () => {
        attempt = 0;
        lastMessageAt = Date.now();
        askedAt = undefined;
        handlers.onStatus("open");
        // HeyTerm is back: panes still waiting to retry try now instead of after their delay.
        for (const terminal of this.terminals) terminal.retryNowIfDown();
        const { fresh, droppedCount } = this.unsent.takeFresh(Date.now());
        for (const text of fresh) socket.send(text);
        if (droppedCount > 0) {
          const text = droppedCount === 1 ? "One thing you said or clicked while HeyTerm was away was not sent. Say it again if you still want it." : `${droppedCount} things you said or clicked while HeyTerm was away were not sent. Say them again if you still want them.`;
          handlers.onMessage({ type: "feedback", feedback: { text, tone: "warning", speak: false } });
        }
      };
      socket.onmessage = (event) => {
        lastMessageAt = Date.now();
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type !== "pong") handlers.onMessage(message);
      };
      socket.onclose = () => reconnectAfterLoss(socket);
    };

    const reconnectAfterLoss = (socket: WebSocket) => {
      if (socket !== this.socket) return;
      this.socket = undefined;
      handlers.onStatus("closed");
      if (stopped) return;
      attempt += 1;
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => void open(), ConnectionHealth.reconnectDelay(attempt));
    };

    // A socket that stopped answering can take a minute to fire close, so it is let go of at once,
    // and the panes' sockets with it: they went the same way.
    const checkHealth = () => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const verdict = ConnectionHealth.verdict(lastMessageAt, askedAt, Date.now());
      if (verdict === "ask") {
        askedAt = Date.now();
        socket.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
      }
      if (verdict === "dead") {
        socket.onclose = null;
        socket.onmessage = null;
        socket.close();
        reconnectAfterLoss(socket);
        for (const terminal of this.terminals) terminal.reconnectNow();
      }
    };
    const healthTimer = window.setInterval(checkHealth, ConnectionHealth.checkEveryMilliseconds);
    // Coming back to the page (a wake, the tab brought forward, the network back) asks at once.
    const checkNow = () => {
      if (askedAt === undefined) lastMessageAt = 0;
      checkHealth();
    };
    const checkWhenShown = () => {
      if (document.visibilityState === "visible") checkNow();
    };
    const checkAfterBackForwardCache = (event: PageTransitionEvent) => {
      if (event.persisted) checkNow();
    };
    // A reload or a closed tab says so, so HeyTerm can tell it from a dropped connection.
    const sayClosing = (event: PageTransitionEvent) => {
      if (!event.persisted && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "page_closing" } satisfies ClientMessage));
    };
    document.addEventListener("visibilitychange", checkWhenShown);
    window.addEventListener("online", checkNow);
    window.addEventListener("pageshow", checkAfterBackForwardCache);
    window.addEventListener("pagehide", sayClosing);

    void open();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(healthTimer);
      document.removeEventListener("visibilitychange", checkWhenShown);
      window.removeEventListener("online", checkNow);
      window.removeEventListener("pageshow", checkAfterBackForwardCache);
      window.removeEventListener("pagehide", sayClosing);
      this.socket?.close();
    };
  }

  send(message: ClientMessage): void {
    const text = JSON.stringify(message);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(text);
    else this.unsent.add(text, Date.now());
  }

  openTerminal(sessionName: string, columns: number, rows: number): TerminalChannel {
    const terminal: ReconnectingTerminal = new ReconnectingTerminal(sessionName, columns, rows, () => this.terminals.delete(terminal));
    this.terminals.add(terminal);
    return terminal.channel;
  }
}

// One pane's socket, opened again at the pane's current size whenever it drops, until the pane
// closes or the server says the session is over.
class ReconnectingTerminal {
  private socket: WebSocket | undefined;
  private attempt = 0;
  private retryTimer: number | undefined;
  private closedByPane = false;
  private hasOpened = false;
  private isLost = false;
  private readonly dataListeners: Array<(data: string) => void> = [];
  private readonly closeListeners: Array<() => void> = [];
  private readonly lostListeners: Array<(cause: PaneLossCause) => void> = [];
  private readonly redrawListeners: Array<() => void> = [];
  // Only before the first connection: keys typed into a pane that lost its connection are not
  // saved up to land in the agent minutes later.
  private readonly pendingBeforeFirstOpen: string[] = [];

  readonly channel: TerminalChannel = {
    onData: (listener) => this.dataListeners.push(listener),
    onClose: (listener) => this.closeListeners.push(listener),
    onConnectionLost: (listener) => this.lostListeners.push(listener),
    onRedraw: (listener) => this.redrawListeners.push(listener),
    write: (data) => this.send(JSON.stringify({ type: "input", data })),
    resize: (columns, rows) => {
      this.columns = columns;
      this.rows = rows;
      this.send(JSON.stringify({ type: "resize", columns, rows }));
    },
    close: () => {
      this.closedByPane = true;
      window.clearTimeout(this.retryTimer);
      this.socket?.close();
      this.onDispose();
    },
  };

  constructor(
    private readonly sessionName: string,
    private columns: number,
    private rows: number,
    private readonly onDispose: () => void,
  ) {
    this.open();
  }

  // The page found its connection dead: this socket may look open and be dead too.
  reconnectNow(): void {
    if (this.closedByPane) return;
    const socket = this.socket;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.close();
    }
    this.notifyLost("heyterm");
    window.clearTimeout(this.retryTimer);
    this.open();
  }

  retryNowIfDown(): void {
    if (this.closedByPane || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    window.clearTimeout(this.retryTimer);
    this.open();
  }

  private open(): void {
    const query = new URLSearchParams({ session: this.sessionName, columns: String(this.columns), rows: String(this.rows) });
    // A tab in the background reconnects too; it must not resize the terminal under the tab in use.
    if (window.document?.visibilityState === "hidden") query.set("background", "1");
    const socket = new WebSocket(socketUrl(`/pty?${query.toString()}`));
    this.socket = socket;
    const isReconnect = this.hasOpened;
    let receivedScreen = false;
    socket.onopen = () => {
      this.hasOpened = true;
      this.pendingBeforeFirstOpen.splice(0).forEach((text) => socket.send(text));
    };
    socket.onmessage = (event) => {
      // The server's first message is the whole screen; the pane clears its old copy just before it.
      if (isReconnect && !receivedScreen) this.redrawListeners.forEach((listener) => listener());
      // Back only once the screen arrives: a remote pane's socket opens here even while the other
      // computer is down, and would otherwise say so and retry at full speed every time.
      if (!receivedScreen) {
        this.isLost = false;
        this.attempt = 0;
      }
      receivedScreen = true;
      this.dataListeners.forEach((listener) => listener(String(event.data)));
    };
    socket.onclose = (event) => {
      if (socket !== this.socket || this.closedByPane) return;
      this.socket = undefined;
      if (!ConnectionHealth.terminalShouldReconnect(event.code)) {
        this.closeListeners.forEach((listener) => listener());
        return;
      }
      this.notifyLost(ConnectionHealth.paneLossCause(event.code));
      this.attempt += 1;
      this.retryTimer = window.setTimeout(() => this.open(), ConnectionHealth.reconnectDelay(this.attempt));
    };
  }

  private notifyLost(cause: PaneLossCause): void {
    if (this.isLost || !this.hasOpened) return;
    this.isLost = true;
    this.lostListeners.forEach((listener) => listener(cause));
  }

  private send(text: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(text);
    else if (!this.hasOpened) this.pendingBeforeFirstOpen.push(text);
  }
}

function socketUrl(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const separator = path.includes("?") ? "&" : "?";
  return `${protocol}//${window.location.host}${path}${separator}token=${encodeURIComponent(pageToken() ?? "")}`;
}
