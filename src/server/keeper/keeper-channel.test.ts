import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { ProcessChannel } from "./keeper-channel.ts";

// A server process whose channel just broke, as Node's ChildProcess reports it: a failed send goes
// to the send's callback when there is one, and otherwise becomes an "error" event, which throws
// when nothing listens.
class ServerThatJustWentAway extends EventEmitter {
  connected = true;
  send(_message: unknown, callback?: (error: Error | null) => void): boolean {
    const error = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
    if (callback) callback(error);
    else this.emit("error", error);
    return false;
  }
}

describe("ProcessChannel to the server", () => {
  // Seen on 30 October 2026: on the VPS an npm update left the server unable to start, and the
  // keeper's hello to the dying server threw EPIPE, which ended the keeper and its terminals.
  it("drops a message to a server that has just gone away, never ending the keeper", () => {
    const channel = ProcessChannel.toServer(new ServerThatJustWentAway() as unknown as ChildProcess);
    expect(() => channel.send({ type: "hello", protocolVersion: 1, names: ["projects"] })).not.toThrow();
  });
});
