import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import { describe, expect, it } from "vitest";
import { TerminalBridge } from "./terminal-bridge.ts";
import type { Terminals } from "../terminals/terminals.ts";

// What the bridge does to the terminal, in order.
function fakeTerminals(calls: string[]): Terminals {
  return {
    attach: (_name: string, _viewer: unknown, columns: number, rows: number) => {
      calls.push(`attach ${columns}x${rows}`);
      return {
        write: (data: string) => void calls.push(`write ${JSON.stringify(data)}`),
        resize: (newColumns: number, newRows: number) => void calls.push(`resize ${newColumns}x${newRows}`),
        detach: () => void calls.push("detach"),
      };
    },
  } as unknown as Terminals;
}

function fakeSocket(): WebSocket & { receive(message: object): void; end(): void } {
  const socket = new EventEmitter() as unknown as WebSocket & { receive(message: object): void; end(): void };
  Object.assign(socket, {
    OPEN: 1,
    readyState: 1,
    send: () => undefined,
    close: () => undefined,
    receive: (message: object) => socket.emit("message", Buffer.from(JSON.stringify(message))),
    end: () => socket.emit("close"),
  });
  return socket;
}

describe("TerminalBridge with a session open in two tabs", () => {
  it("gives the terminal the size of the pane typed into before the keys reach it", () => {
    const calls: string[] = [];
    const bridge = new TerminalBridge(fakeTerminals(calls));
    const halfWidthPane = fakeSocket();
    bridge.connect(halfWidthPane, "heyterm", 106, 44);
    bridge.connect(fakeSocket(), "heyterm", 218, 44);
    halfWidthPane.receive({ type: "input", data: "\x0f" });
    expect(calls).toEqual(["attach 106x44", "attach 218x44", "resize 106x44", 'write "\\u000f"']);
  });

  it("keeps the size of the pane in use when a tab in the background opens the same session", () => {
    const calls: string[] = [];
    const bridge = new TerminalBridge(fakeTerminals(calls));
    bridge.connect(fakeSocket(), "heyterm", 106, 44);
    bridge.connect(fakeSocket(), "heyterm", 218, 44, { isInUse: false });
    expect(calls).toEqual(["attach 106x44", "attach 218x44", "resize 106x44"]);
  });

  it("goes back to the other pane's size when the pane that set it closes", () => {
    const calls: string[] = [];
    const bridge = new TerminalBridge(fakeTerminals(calls));
    bridge.connect(fakeSocket(), "heyterm", 106, 44);
    const fullWidthPane = fakeSocket();
    bridge.connect(fullWidthPane, "heyterm", 218, 44);
    fullWidthPane.end();
    expect(calls).toEqual(["attach 106x44", "attach 218x44", "resize 106x44", "detach"]);
  });

  it("passes a pane's own resize on", () => {
    const calls: string[] = [];
    const bridge = new TerminalBridge(fakeTerminals(calls));
    const pane = fakeSocket();
    bridge.connect(pane, "heyterm", 106, 44);
    pane.receive({ type: "resize", columns: 150, rows: 40 });
    pane.receive({ type: "input", data: "a" });
    expect(calls).toEqual(["attach 106x44", "resize 150x40", 'write "a"']);
  });
});
