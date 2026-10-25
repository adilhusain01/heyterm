import { describe, expect, it } from "vitest";
import { ConnectionHealth } from "./connection-health.ts";

const second = 1_000;

describe("ConnectionHealth.verdict", () => {
  it("leaves a socket alone while messages keep arriving", () => {
    expect(ConnectionHealth.verdict(100 * second, undefined, 105 * second)).toBe("fine");
  });

  it("asks the server for a reply after a quiet stretch", () => {
    expect(ConnectionHealth.verdict(100 * second, undefined, 115 * second)).toBe("ask");
  });

  it("waits for the reply for a moment", () => {
    expect(ConnectionHealth.verdict(100 * second, 115 * second, 117 * second)).toBe("waiting");
  });

  // Seen on 26 October 2026: after the Mac woke from hibernation the page kept a socket that never
  // delivered another message and never closed, so it showed the state from before the sleep.
  it("gives up on a socket that did not answer in time", () => {
    expect(ConnectionHealth.verdict(100 * second, 115 * second, 120 * second)).toBe("dead");
  });

  it("counts any message after the question as the answer", () => {
    expect(ConnectionHealth.verdict(116 * second, 115 * second, 125 * second)).toBe("fine");
  });

  it("asks at once after the Mac wakes, since the last message is from before the sleep", () => {
    expect(ConnectionHealth.verdict(100 * second, undefined, 4 * 3_600 * second)).toBe("ask");
  });
});

describe("ConnectionHealth.terminalShouldReconnect", () => {
  it("connects a pane again after its connection dropped or HeyTerm restarted", () => {
    expect(ConnectionHealth.terminalShouldReconnect(1006)).toBe(true);
    expect(ConnectionHealth.terminalShouldReconnect(1001)).toBe(true);
  });

  it("stops when the session ended or no longer exists", () => {
    expect(ConnectionHealth.terminalShouldReconnect(1000)).toBe(false);
    expect(ConnectionHealth.terminalShouldReconnect(4404)).toBe(false);
  });
});

describe("ConnectionHealth.reconnectDelay", () => {
  it("tries again quickly at first and never waits longer than five seconds", () => {
    expect(ConnectionHealth.reconnectDelay(1)).toBe(500);
    expect(ConnectionHealth.reconnectDelay(2)).toBe(1_000);
    expect(ConnectionHealth.reconnectDelay(20)).toBe(5_000);
  });
});

describe("ConnectionHealth.outageNotice", () => {
  it("says nothing about a blip, such as a reload of the server's socket", () => {
    expect(ConnectionHealth.outageNotice(3 * second)).toBeUndefined();
  });

  it("says it is reconnecting once the outage is long enough to notice", () => {
    expect(ConnectionHealth.outageNotice(6 * second)).toBe("reconnecting");
  });

  it("says HeyTerm is not answering, and how to start it, when the outage goes on", () => {
    expect(ConnectionHealth.outageNotice(30 * second)).toBe("not_answering");
  });
});
