import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SocketConnection } from "./socket-connection.ts";

// A stand-in for the browser's WebSocket that the test opens, feeds and closes by hand.
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static opened: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }
  send(text: string): void {
    this.sent.push(text);
  }
  close(): void {
    this.readyState = FakeSocket.CLOSED;
  }
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(data: string): void {
    this.onmessage?.({ data });
  }
  drop(code: number): void {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.opened = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("window", { setTimeout, clearTimeout, location: { protocol: "http:", host: "127.0.0.1:4747" } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("A terminal pane's connection", () => {
  // Seen on 26 October 2026: with the VPS down, a vps/ pane printed "Lost the connection to
  // HeyTerm" every half second, because this Mac's HeyTerm took each socket and then closed it.
  it("says once that the other computer is unreachable, and waits longer each time it still is", () => {
    const lost: string[] = [];
    const channel = new SocketConnection().openTerminal("vps/voice-sticky", 100, 30);
    channel.onConnectionLost?.((cause) => lost.push(cause));
    const first = FakeSocket.opened[0]!;
    first.open();
    first.receive("screen");
    first.drop(4502);
    expect(lost).toEqual(["remote"]);

    vi.advanceTimersByTime(500);
    const second = FakeSocket.opened[1]!;
    second.open();
    second.drop(4502);
    expect(lost).toEqual(["remote"]);

    vi.advanceTimersByTime(999);
    expect(FakeSocket.opened).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.opened).toHaveLength(3);
  });

  it("says it lost this computer's HeyTerm when that is what dropped", () => {
    const lost: string[] = [];
    const channel = new SocketConnection().openTerminal("whisker", 100, 30);
    channel.onConnectionLost?.((cause) => lost.push(cause));
    FakeSocket.opened[0]!.open();
    FakeSocket.opened[0]!.receive("screen");
    FakeSocket.opened[0]!.drop(1006);
    expect(lost).toEqual(["heyterm"]);
  });

  it("counts as back once its screen arrives, so a later drop is told again", () => {
    const lost: string[] = [];
    const channel = new SocketConnection().openTerminal("vps/voice-sticky", 100, 30);
    channel.onConnectionLost?.((cause) => lost.push(cause));
    FakeSocket.opened[0]!.open();
    FakeSocket.opened[0]!.receive("screen");
    FakeSocket.opened[0]!.drop(4502);
    vi.advanceTimersByTime(500);
    FakeSocket.opened[1]!.open();
    FakeSocket.opened[1]!.receive("screen again");
    FakeSocket.opened[1]!.drop(4502);
    expect(lost).toEqual(["remote", "remote"]);
  });
});
