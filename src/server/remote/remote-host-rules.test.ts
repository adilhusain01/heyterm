import { describe, expect, it } from "vitest";
import { RemoteHostRules } from "./remote-host-rules.ts";
import type { SessionView } from "../../shared/types.ts";

function session(overrides: Partial<SessionView> = {}): SessionView {
  return { name: "voice-sticky", origin: "heyterm", projectPath: "/root/Projects/voice-sticky", projectName: "voice-sticky", agent: "claude", state: "working", stateSince: 0, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0, ...overrides };
}

describe("RemoteHostRules names", () => {
  it("names a session on another computer after that computer, so it never clashes with one here", () => {
    expect(RemoteHostRules.mirroredName("vps", "voice-sticky")).toBe("vps/voice-sticky");
  });

  it("splits a mirrored name back into the computer and its own name, and leaves a local one alone", () => {
    expect(RemoteHostRules.split("vps/voice-sticky")).toEqual({ host: "vps", name: "voice-sticky" });
    expect(RemoteHostRules.split("whisker")).toBeUndefined();
  });
});

describe("RemoteHostRules.mirror", () => {
  // The scenario of 26 October 2026: a Claude session on the VPS should show here like any other.
  it("shows a remote session under its computer's name, keeping its state, request and face", () => {
    const pending = { kind: "permission" as const, requestId: "r1", toolName: "Bash", toolInput: {}, summary: "npm test", risk: "low" as const, riskReasons: [], createdAt: 0 };
    const mirrored = RemoteHostRules.mirror("vps", session({ pending, state: "needs_permission" }));
    expect(mirrored).toMatchObject({ name: "vps/voice-sticky", host: "vps", state: "needs_permission", faceSeed: "voice-sticky" });
    expect(mirrored.pending?.requestId).toBe("r1");
  });

  it("keeps the face a renamed remote session already had", () => {
    expect(RemoteHostRules.mirror("vps", session({ name: "sticky", faceSeed: "voice-sticky" })).faceSeed).toBe("voice-sticky");
  });

  it("shows a remote session's closed sessions under its computer's name too", () => {
    const closed = RemoteHostRules.mirrorClosed("vps", { name: "old-one", projectName: "old-one", agent: "claude", closedAt: 5 });
    expect(closed).toMatchObject({ name: "vps/old-one", host: "vps", state: "stopped", stateSince: 5 });
  });
});

describe("RemoteHostRules.forwardedAction", () => {
  it("sends what you did to a remote session to its computer, under the name it has there", () => {
    expect(RemoteHostRules.forwardedAction({ type: "send", session: "vps/voice-sticky", text: "run the tests", needsPreview: true })).toEqual({ type: "send", session: "voice-sticky", text: "run the tests", needsPreview: false });
    expect(RemoteHostRules.forwardedAction({ type: "approve", session: "vps/voice-sticky", requestId: "r1", confirmed: false })).toEqual({ type: "approve", session: "voice-sticky", requestId: "r1", confirmed: true });
  });

  // A preview or a "say confirm" already happened here; asking again there would wait on nobody.
  it("marks it as already confirmed, since the confirming happened on this computer", () => {
    expect(RemoteHostRules.forwardedAction({ type: "close", session: "vps/voice-sticky", confirmed: false })).toEqual({ type: "close", session: "voice-sticky", confirmed: true });
  });

  it("forwards nothing for a local session", () => {
    expect(RemoteHostRules.forwardedAction({ type: "close", session: "whisker", confirmed: true })).toBeUndefined();
  });
});

describe("RemoteHostRules.readRemotes", () => {
  it("reads the computers this HeyTerm shows sessions from", () => {
    const text = JSON.stringify([{ name: "vps", url: "https://vps.example.ts.net:8443", token: "secret" }]);
    expect(RemoteHostRules.readRemotes(text)).toEqual([{ name: "vps", url: "https://vps.example.ts.net:8443", token: "secret" }]);
  });

  // The token reaches the remote computer in the address, so a plain connection would show it on the network.
  it("refuses a plain http address except to this computer", () => {
    expect(RemoteHostRules.readRemotes(JSON.stringify([{ name: "vps", url: "http://vps.example.ts.net:8443", token: "secret" }]))).toEqual([]);
    expect(RemoteHostRules.readRemotes(JSON.stringify([{ name: "local", url: "http://127.0.0.1:4860", token: "secret" }]))).toHaveLength(1);
  });

  it("refuses a name that could not stand before a session's name, and a file it cannot read", () => {
    expect(RemoteHostRules.readRemotes(JSON.stringify([{ name: "My VPS", url: "https://a.ts.net", token: "secret" }]))).toEqual([]);
    expect(RemoteHostRules.readRemotes("not json")).toEqual([]);
  });

  it("builds the socket address for a page or a terminal on the remote computer", () => {
    expect(RemoteHostRules.socketUrl("https://vps.example.ts.net:8443", "/ws", "s3cret")).toBe("wss://vps.example.ts.net:8443/ws?token=s3cret");
    expect(RemoteHostRules.socketUrl("http://127.0.0.1:4860", "/pty?session=a", "t")).toBe("ws://127.0.0.1:4860/pty?session=a&token=t");
  });
});
