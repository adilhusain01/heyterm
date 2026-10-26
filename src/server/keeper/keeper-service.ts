// The keeper's side: it owns the terminals (TerminalHost) and serves one server at a time over a
// channel. When that server goes away its pages' views are let go, and the terminals keep running
// for the next one.

import { keeperProtocolVersion, type ServerMessage } from "./keeper-protocol.ts";
import type { KeeperEnd } from "./keeper-channel.ts";
import type { TerminalAttachment, TerminalHost } from "../terminals/terminal-host.ts";

export class KeeperService {
  private channel: KeeperEnd | undefined;
  // The current server's open views, by the id it gave each.
  private attachments = new Map<number, TerminalAttachment>();

  constructor(private readonly host: TerminalHost) {
    host.on("exit", (name) => {
      this.channel?.send({ type: "exit", name });
      this.sendNames();
    });
  }

  runningNames(): string[] {
    return this.host.listSessions().map((session) => session.name);
  }

  serve(channel: KeeperEnd): void {
    this.letGoOfCurrentServer();
    this.channel = channel;
    channel.onMessage((message) => {
      if (this.channel === channel) void this.handle(message);
    });
    channel.onClose(() => {
      if (this.channel === channel) this.letGoOfCurrentServer();
    });
    channel.send({ type: "hello", protocolVersion: keeperProtocolVersion, names: this.runningNames() });
  }

  endAll(): void {
    this.letGoOfCurrentServer();
    this.host.shutdown();
  }

  private async handle(message: ServerMessage): Promise<void> {
    const channel = this.channel!;
    switch (message.type) {
      case "create":
        try {
          this.host.createSession(message.session);
          channel.send({ type: "reply", requestId: message.requestId });
        } catch (error) {
          channel.send({ type: "reply", requestId: message.requestId, error: error instanceof Error ? error.message : String(error) });
        }
        return this.sendNames();
      case "rename":
        this.host.renameSession(message.currentName, message.newName);
        return this.sendNames();
      case "kill":
        this.host.killSession(message.name);
        return this.sendNames();
      case "paste":
        return this.host.pasteText(message.name, message.text);
      case "keys":
        return this.host.pressKeys(message.name, message.keys);
      case "foreground":
        return channel.send({ type: "reply", requestId: message.requestId, result: this.host.foregroundProgram(message.name) });
      case "capture":
        return channel.send({ type: "reply", requestId: message.requestId, result: await this.host.captureScreen(message.name) });
      case "attach": {
        const attachId = message.attachId;
        const viewer = {
          send: (data: string) => channel.send({ type: "data", attachId, data }),
          close: () => {
            this.attachments.delete(attachId);
            channel.send({ type: "viewer_closed", attachId });
          },
        };
        const attachment = this.host.attach(message.name, viewer, message.columns, message.rows);
        if (attachment) this.attachments.set(attachId, attachment);
        else channel.send({ type: "viewer_closed", attachId });
        return;
      }
      case "write":
        return this.attachments.get(message.attachId)?.write(message.data);
      case "resize":
        return this.attachments.get(message.attachId)?.resize(message.columns, message.rows);
      case "detach":
        this.attachments.get(message.attachId)?.detach();
        this.attachments.delete(message.attachId);
        return;
      case "end_all":
        return this.endAll();
      case "listening":
        return;
    }
  }

  private sendNames(): void {
    this.channel?.send({ type: "names", names: this.runningNames() });
  }

  private letGoOfCurrentServer(): void {
    for (const attachment of this.attachments.values()) attachment.detach();
    this.attachments.clear();
    this.channel = undefined;
  }
}
