// The line between the terminal keeper and the server it runs: messages each way, and a close.
// Between processes it is Node's own child process channel, which works on every system; in tests
// it is two ends in memory.

import type { ChildProcess } from "node:child_process";
import type { KeeperMessage, ServerMessage } from "./keeper-protocol.ts";

export interface KeeperChannel<Outgoing, Incoming> {
  send(message: Outgoing): void;
  onMessage(listener: (message: Incoming) => void): void;
  onClose(listener: () => void): void;
  close(): void;
}

// The server's end, talking to the keeper.
export type ServerEnd = KeeperChannel<ServerMessage, KeeperMessage>;
// The keeper's end, talking to one server.
export type KeeperEnd = KeeperChannel<KeeperMessage, ServerMessage>;

export class InMemoryChannel {
  static pair(): [ServerEnd, KeeperEnd] {
    const serverListeners: Array<(message: KeeperMessage) => void> = [];
    const keeperListeners: Array<(message: ServerMessage) => void> = [];
    const closeListeners: Array<() => void> = [];
    let isClosed = false;
    const close = () => {
      if (isClosed) return;
      isClosed = true;
      closeListeners.splice(0).forEach((listener) => listener());
    };
    // Delivered on a later tick, as a real channel would, so neither side runs inside the other's call.
    const deliver = <Message>(listeners: Array<(message: Message) => void>, message: Message) => {
      if (isClosed) return;
      const copy = structuredClone(message);
      setImmediate(() => !isClosed && listeners.forEach((listener) => listener(copy)));
    };
    const serverEnd: ServerEnd = {
      send: (message) => deliver(keeperListeners, message),
      onMessage: (listener) => serverListeners.push(listener),
      onClose: (listener) => closeListeners.push(listener),
      close,
    };
    const keeperEnd: KeeperEnd = {
      send: (message) => deliver(serverListeners, message),
      onMessage: (listener) => keeperListeners.push(listener),
      onClose: (listener) => closeListeners.push(listener),
      close,
    };
    return [serverEnd, keeperEnd];
  }
}

export class ProcessChannel {
  // Inside the server, which the keeper started with an IPC channel.
  static toKeeper(): ServerEnd {
    return {
      send: (message) => {
        if (process.connected) process.send?.(message);
      },
      onMessage: (listener) => process.on("message", (message) => listener(message as KeeperMessage)),
      onClose: (listener) => process.once("disconnect", listener),
      close: () => process.disconnect?.(),
    };
  }

  // Inside the keeper, for the server it started.
  static toServer(child: ChildProcess): KeeperEnd {
    return {
      send: (message) => {
        // A server that just went away fails the write. With no callback Node raises that as an
        // error that ends the keeper and every terminal; its exit is handled where it was started.
        if (child.connected) child.send(message, () => undefined);
      },
      onMessage: (listener) => child.on("message", (message) => listener(message as ServerMessage)),
      onClose: (listener) => child.once("disconnect", listener),
      close: () => child.connected && child.disconnect(),
    };
  }
}
