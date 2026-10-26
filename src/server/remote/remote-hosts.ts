// The other computers whose HeyTerm this one shows (~/.heyterm/remotes.json): one socket to each,
// whose snapshots become "host/name" sessions here, and a way to send them what you do. The other
// HeyTerm keeps its sessions, hooks and held requests, so they go on while this computer sleeps.
// Rules in remote-host-rules.ts.

import headlessModule from "@xterm/headless";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { RemoteHostRules, type RemoteHost } from "./remote-host-rules.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { ClosedSessionView, Feedback, ServerMessage } from "../../shared/protocol.ts";
import type { RouterAction } from "../../shared/types.ts";

const { Terminal } = headlessModule;

// How long the other HeyTerm gets to answer an action, and how often its socket is checked.
const answerWaitMilliseconds = 10_000;
const pingEveryMilliseconds = 20_000;
const longestReconnectDelayMilliseconds = 10_000;
const screenColumns = 120;
const screenRows = 40;

interface Connection {
  host: RemoteHost;
  socket: WebSocket | undefined;
  connected: boolean;
  attempt: number;
  retryTimer: NodeJS.Timeout | undefined;
  pingTimer: NodeJS.Timeout | undefined;
  answeredPing: boolean;
  // Actions sent and waiting for the feedback the other HeyTerm answers them with, oldest first.
  waitingForAnswer: Array<(feedback: Feedback) => void>;
  // Pane sockets open on that computer. A network drop closes none of them, so they are ended with
  // the connection, which notices it by its ping.
  terminals: Set<WebSocket>;
}

export class RemoteHosts extends EventEmitter<{ feedback: [Feedback] }> {
  private readonly connections = new Map<string, Connection>();
  private stopped = false;

  constructor(
    private readonly registry: SessionRegistry,
    hosts: RemoteHost[],
  ) {
    super();
    for (const host of hosts) this.connections.set(host.name, { host, socket: undefined, connected: false, attempt: 0, retryTimer: undefined, pingTimer: undefined, answeredPing: true, waitingForAnswer: [], terminals: new Set() });
  }

  start(): void {
    for (const connection of this.connections.values()) this.connect(connection);
  }

  stop(): void {
    this.stopped = true;
    for (const connection of this.connections.values()) {
      clearTimeout(connection.retryTimer);
      clearInterval(connection.pingTimer);
      connection.socket?.terminate();
    }
  }

  isRemote(sessionName: string): boolean {
    const split = RemoteHostRules.split(sessionName);
    return split !== undefined && this.connections.has(split.host);
  }

  // Sends one action on a "host/name" session to its computer, and returns what that computer said.
  async perform(action: RouterAction): Promise<Feedback> {
    const forwarded = RemoteHostRules.forwardedAction(action);
    const hostName = "session" in action && typeof action.session === "string" ? RemoteHostRules.split(action.session)?.host : undefined;
    const connection = hostName ? this.connections.get(hostName) : undefined;
    if (!forwarded || !connection) return { text: "That cannot be done on another computer's session.", tone: "warning", speak: true };
    if (!connection.connected || connection.socket?.readyState !== WebSocket.OPEN) return unreachable(connection.host.name);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        connection.waitingForAnswer = connection.waitingForAnswer.filter((waiter) => waiter !== answer);
        resolve({ text: `${connection.host.name} did not answer in time. Check the session there.`, tone: "warning", speak: true });
      }, answerWaitMilliseconds);
      const answer = (feedback: Feedback) => {
        clearTimeout(timer);
        resolve(feedback);
      };
      connection.waitingForAnswer.push(answer);
      connection.socket!.send(JSON.stringify({ type: "action", action: forwarded }));
    });
  }

  // A remote session's screen as text, from the copy its computer sends any terminal that opens.
  async readScreen(sessionName: string): Promise<string> {
    const socket = this.openTerminal(sessionName, screenColumns, screenRows);
    if (!socket) return "";
    const screenCopy = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve(""), 5_000);
      socket.once("message", (data) => {
        clearTimeout(timer);
        resolve(String(data));
      });
      socket.once("error", () => resolve(""));
    });
    socket.close();
    const screen = new Terminal({ cols: screenColumns, rows: screenRows, allowProposedApi: true });
    await new Promise<void>((resolve) => screen.write(screenCopy, resolve));
    const buffer = screen.buffer.active;
    const lines: string[] = [];
    for (let row = 0; row < screen.rows; row += 1) lines.push(buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? "");
    screen.dispose();
    return lines.join("\n");
  }

  // A socket to a remote session's terminal, for a pane here or a screen read.
  openTerminal(sessionName: string, columns: number, rows: number): WebSocket | undefined {
    const split = RemoteHostRules.split(sessionName);
    const connection = split ? this.connections.get(split.host) : undefined;
    if (!split || !connection) return undefined;
    const query = new URLSearchParams({ session: split.name, columns: String(columns), rows: String(rows) });
    const socket = new WebSocket(RemoteHostRules.socketUrl(connection.host.url, `/pty?${query.toString()}`, connection.host.token));
    socket.on("error", () => undefined);
    connection.terminals.add(socket);
    socket.on("close", () => connection.terminals.delete(socket));
    return socket;
  }

  // An image dropped on a remote session goes to its computer, which saves it and gives it to the session.
  async attach(sessionName: string, bytes: Buffer, contentType: string): Promise<{ ok: boolean; text: string }> {
    const split = RemoteHostRules.split(sessionName);
    const connection = split ? this.connections.get(split.host) : undefined;
    if (!split || !connection) return { ok: false, text: `There is no session called ${sessionName}.` };
    try {
      const response = await fetch(new URL(`/attachments?session=${encodeURIComponent(split.name)}`, connection.host.url), {
        method: "POST",
        headers: { "content-type": contentType, "x-heyterm-token": connection.host.token },
        body: new Uint8Array(bytes),
      });
      const answer = (await response.json().catch(() => ({}))) as { text?: string };
      return { ok: response.ok, text: answer.text ?? (response.ok ? `Attached to ${sessionName}.` : `${split.host} refused the image.`) };
    } catch {
      return { ok: false, text: unreachable(split.host).text };
    }
  }

  private connect(connection: Connection): void {
    if (this.stopped) return;
    const socket = new WebSocket(RemoteHostRules.socketUrl(connection.host.url, "/ws", connection.host.token));
    connection.socket = socket;
    socket.on("open", () => {
      const cameBack = connection.attempt > 0;
      connection.connected = true;
      connection.attempt = 0;
      connection.answeredPing = true;
      clearInterval(connection.pingTimer);
      // A socket that went quiet without closing (the network dropped) is ended, and tried again.
      connection.pingTimer = setInterval(() => {
        if (!connection.answeredPing) return socket.terminate();
        connection.answeredPing = false;
        socket.ping();
      }, pingEveryMilliseconds);
      if (cameBack) this.emit("feedback", { text: `Connected to ${connection.host.name} again.`, tone: "success", speak: false });
    });
    socket.on("pong", () => (connection.answeredPing = true));
    socket.on("message", (data) => this.receive(connection, String(data)));
    socket.on("error", () => undefined);
    socket.on("close", () => {
      if (socket !== connection.socket) return;
      clearInterval(connection.pingTimer);
      const wasConnected = connection.connected;
      connection.connected = false;
      for (const waiter of connection.waitingForAnswer.splice(0)) waiter(unreachable(connection.host.name));
      if (wasConnected) this.registry.markHostUnreachable(connection.host.name);
      for (const terminal of connection.terminals) terminal.terminate();
      if (wasConnected) this.emit("feedback", { text: `Lost the connection to ${connection.host.name}. Its sessions show as they last were, and HeyTerm keeps trying.`, tone: "warning", speak: true });
      if (this.stopped) return;
      connection.attempt += 1;
      connection.retryTimer = setTimeout(() => this.connect(connection), Math.min(longestReconnectDelayMilliseconds, 500 * 2 ** connection.attempt));
    });
  }

  private receive(connection: Connection, text: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(text) as ServerMessage;
    } catch {
      return;
    }
    const host = connection.host.name;
    if (message.type === "snapshot") {
      const sessions = message.sessions.map((session) => RemoteHostRules.mirror(host, session));
      const closed = message.recentlyClosed.map((session: ClosedSessionView) => RemoteHostRules.mirrorClosed(host, session));
      this.registry.replaceHostSessions(host, sessions, closed);
    }
    // Only feedback answers an action; the other HeyTerm's own talk is not this computer's to repeat.
    if (message.type === "feedback") connection.waitingForAnswer.shift()?.(message.feedback);
  }
}

function unreachable(host: string): Feedback {
  return { text: `${host} is not reachable right now, so nothing was done there. HeyTerm keeps trying to connect.`, tone: "warning", speak: true };
}
