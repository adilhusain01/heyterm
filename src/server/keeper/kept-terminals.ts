// The server's side: the same calls as TerminalHost, carried out by the terminal keeper. It keeps
// a copy of which terminals run, so the questions asked often (is it running, which are there) are
// answered at once, and the keeper sends every change.

import { EventEmitter } from "node:events";
import { keeperProtocolVersion, type KeeperMessage } from "./keeper-protocol.ts";
import type { ServerEnd } from "./keeper-channel.ts";
import type { NewTerminalSession, TerminalAttachment, TerminalViewer } from "../terminals/terminal-host.ts";

export class KeptTerminals extends EventEmitter<{ exit: [string]; restart: [] }> {
  // Resolves with the keeper's first message, which names the terminals that outlived the last server.
  readonly ready: Promise<string[]>;
  private names = new Set<string>();
  private nextId = 1;
  private readonly replies = new Map<number, (reply: Extract<KeeperMessage, { type: "reply" }>) => void>();
  private readonly viewers = new Map<number, TerminalViewer>();

  constructor(private readonly channel: ServerEnd) {
    super();
    let markReady: (names: string[]) => void = () => undefined;
    this.ready = new Promise((resolve) => (markReady = resolve));
    channel.onMessage((message) => {
      if (message.type === "hello") {
        if (message.protocolVersion !== keeperProtocolVersion) console.error("HeyTerm's terminal keeper is from another version. Run heyterm stop, then heyterm.");
        this.names = new Set(message.names);
        markReady(message.names);
      }
      this.receive(message);
    });
  }

  listSessions(): Array<{ name: string }> {
    return [...this.names].map((name) => ({ name }));
  }

  hasSession(name: string): boolean {
    return this.names.has(name);
  }

  // Answers at once, as TerminalHost does. A program that cannot start comes back as an exit.
  createSession(session: NewTerminalSession): void {
    if (this.names.has(session.name)) throw new Error(`A terminal called ${session.name} is already running.`);
    this.names.add(session.name);
    void this.request<undefined>((requestId) => ({ type: "create", requestId, session })).catch((error: Error) => {
      console.error(`Could not start ${session.name}: ${error.message}`);
      this.names.delete(session.name);
      this.emit("exit", session.name);
    });
  }

  renameSession(currentName: string, newName: string): void {
    if (!this.names.has(currentName) || this.names.has(newName)) return;
    this.names.delete(currentName);
    this.names.add(newName);
    this.channel.send({ type: "rename", currentName, newName });
  }

  killSession(name: string): void {
    this.names.delete(name);
    this.channel.send({ type: "kill", name });
  }

  pasteText(name: string, text: string): void {
    this.channel.send({ type: "paste", name, text });
  }

  pressKeys(name: string, keys: string[]): void {
    this.channel.send({ type: "keys", name, keys });
  }

  foregroundProgram(name: string): Promise<string | undefined> {
    return this.request<string | undefined>((requestId) => ({ type: "foreground", requestId, name })).catch(() => undefined);
  }

  captureScreen(name: string): Promise<string> {
    return this.request<string | undefined>((requestId) => ({ type: "capture", requestId, name })).then(
      (screen) => screen ?? "",
      () => "",
    );
  }

  attach(name: string, viewer: TerminalViewer, columns: number, rows: number): TerminalAttachment | undefined {
    if (!this.names.has(name)) return undefined;
    const attachId = this.nextId++;
    this.viewers.set(attachId, viewer);
    this.channel.send({ type: "attach", attachId, name, columns, rows });
    return {
      write: (data) => this.channel.send({ type: "write", attachId, data }),
      resize: (newColumns, newRows) => this.channel.send({ type: "resize", attachId, columns: newColumns, rows: newRows }),
      detach: () => {
        this.viewers.delete(attachId);
        this.channel.send({ type: "detach", attachId });
      },
    };
  }

  // HeyTerm is stopping for good, so its terminals end too.
  shutdown(): void {
    this.names.clear();
    this.channel.send({ type: "end_all" });
  }

  announceListening(): void {
    this.channel.send({ type: "listening" });
  }

  // This server is going away and the terminals stay, for the next one.
  close(): void {
    this.channel.close();
  }

  private receive(message: KeeperMessage): void {
    if (message.type === "names") this.names = new Set(message.names);
    if (message.type === "reply") {
      this.replies.get(message.requestId)?.(message);
      this.replies.delete(message.requestId);
    }
    if (message.type === "data") this.viewers.get(message.attachId)?.send(message.data);
    if (message.type === "viewer_closed") {
      this.viewers.get(message.attachId)?.close();
      this.viewers.delete(message.attachId);
    }
    if (message.type === "please_restart") this.emit("restart");
    if (message.type === "exit") {
      this.names.delete(message.name);
      this.emit("exit", message.name);
    }
  }

  private request<Result>(build: (requestId: number) => Parameters<ServerEnd["send"]>[0]): Promise<Result> {
    const requestId = this.nextId++;
    return new Promise<Result>((resolve, reject) => {
      this.replies.set(requestId, (reply) => (reply.error ? reject(new Error(reply.error)) : resolve(reply.result as Result)));
      this.channel.send(build(requestId));
    });
  }
}
