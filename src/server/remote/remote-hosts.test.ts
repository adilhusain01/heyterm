import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";
import { RemoteHosts } from "./remote-hosts.ts";
import { SessionRegistry } from "../sessions/session-registry.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { StateStore } from "../sessions/state-store.ts";
import type { SessionView } from "../../shared/types.ts";

// Ports stay below 49152: Windows reserves ranges above it.
const servers: WebSocketServer[] = [];
const hostsToStop: RemoteHosts[] = [];
afterEach(async () => {
  hostsToStop.splice(0).forEach((hosts) => hosts.stop());
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

function registry(): SessionRegistry {
  return new SessionRegistry({ save: async () => undefined } as unknown as StateStore, { letGoAllFor: () => undefined } as unknown as HeldHookRequests);
}

const remoteSession: SessionView = { name: "voice-sticky", origin: "heyterm", projectPath: "/root/Projects/voice-sticky", projectName: "voice-sticky", agent: "claude", state: "needs_permission", stateSince: 0, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0 };

// The path each socket the stand-in took came in on, so a test can drop the main one alone.
const pathOfSocket = new WeakMap<WebSocket, string>();

// A stand-in for the VPS's HeyTerm: it sends a snapshot on connect, and answers an action with feedback.
function fakeRemote(port: number, received: unknown[]): Promise<void> {
  const server = new WebSocketServer({ host: "127.0.0.1", port });
  servers.push(server);
  server.on("connection", (socket: WebSocket, request) => {
    if (!request.url?.includes("token=remote-token")) return socket.close(4401);
    pathOfSocket.set(socket, request.url);
    socket.send(JSON.stringify({ type: "snapshot", sessions: [remoteSession], recentlyClosed: [{ name: "old", projectName: "old", closedAt: 5 }], projects: [], control: {}, serverTime: 0 }));
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      received.push(message);
      if (message.type === "action") socket.send(JSON.stringify({ type: "feedback", feedback: { text: `Approved for ${message.action.session}: npm test`, tone: "success", speak: false } }));
    });
  });
  return new Promise((resolve) => server.on("listening", () => resolve()));
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let tries = 0; tries < 100 && !check(); tries += 1) await new Promise((resolve) => setTimeout(resolve, 20));
}

describe("RemoteHosts", () => {
  it("shows the other computer's sessions here under its name, closed ones too", async () => {
    const port = 44_100 + Math.floor(Math.random() * 400);
    await fakeRemote(port, []);
    const sessions = registry();
    const hosts = new RemoteHosts(sessions, [{ name: "vps", url: `http://127.0.0.1:${port}`, token: "remote-token" }]);
    hostsToStop.push(hosts);
    hosts.start();
    await waitFor(() => sessions.get("vps/voice-sticky") !== undefined);
    expect(sessions.get("vps/voice-sticky")).toMatchObject({ host: "vps", state: "needs_permission" });
    expect(sessions.recentlyClosedSessions().map((closed) => closed.name)).toEqual(["vps/old"]);
  });

  it("sends an action on a remote session to its computer and returns what that computer said", async () => {
    const port = 44_500 + Math.floor(Math.random() * 400);
    const received: unknown[] = [];
    await fakeRemote(port, received);
    const sessions = registry();
    const hosts = new RemoteHosts(sessions, [{ name: "vps", url: `http://127.0.0.1:${port}`, token: "remote-token" }]);
    hostsToStop.push(hosts);
    hosts.start();
    await waitFor(() => sessions.get("vps/voice-sticky") !== undefined);
    const feedback = await hosts.perform({ type: "approve", session: "vps/voice-sticky", requestId: "r1", confirmed: false });
    expect(received).toContainEqual({ type: "action", action: { type: "approve", session: "voice-sticky", requestId: "r1", confirmed: true } });
    expect(feedback.text).toBe("Approved for voice-sticky: npm test");
  });

  it("marks the other computer's sessions unreachable when its connection drops", async () => {
    const port = 44_900 + Math.floor(Math.random() * 90);
    await fakeRemote(port, []);
    const sessions = registry();
    const hosts = new RemoteHosts(sessions, [{ name: "vps", url: `http://127.0.0.1:${port}`, token: "remote-token" }]);
    hostsToStop.push(hosts);
    hosts.start();
    await waitFor(() => sessions.get("vps/voice-sticky") !== undefined);
    servers[0]!.clients.forEach((client) => client.terminate());
    await waitFor(() => sessions.get("vps/voice-sticky")?.hostUnreachable === true);
    expect(sessions.get("vps/voice-sticky")).toMatchObject({ hostUnreachable: true, state: "needs_permission" });
  });

  // A network drop closes nothing: the pane would sit frozen while the connection waits for its ping.
  it("ends the panes open on the other computer when its connection drops", async () => {
    const port = 44_990 + Math.floor(Math.random() * 9);
    await fakeRemote(port, []);
    const sessions = registry();
    const hosts = new RemoteHosts(sessions, [{ name: "vps", url: `http://127.0.0.1:${port}`, token: "remote-token" }]);
    hostsToStop.push(hosts);
    hosts.start();
    await waitFor(() => sessions.get("vps/voice-sticky") !== undefined);
    const pane = hosts.openTerminal("vps/voice-sticky", 100, 30)!;
    await waitFor(() => pane.readyState === pane.OPEN);
    let paneClosed = false;
    pane.on("close", () => (paneClosed = true));
    servers[0]!.clients.forEach((client) => {
      if (pathOfSocket.get(client)?.startsWith("/ws")) client.terminate();
    });
    await waitFor(() => paneClosed);
    expect(paneClosed).toBe(true);
  });

  it("says so when the other computer cannot be reached, instead of pretending it worked", async () => {
    const sessions = registry();
    const hosts = new RemoteHosts(sessions, [{ name: "vps", url: "http://127.0.0.1:44999", token: "remote-token" }]);
    hostsToStop.push(hosts);
    const feedback = await hosts.perform({ type: "close", session: "vps/voice-sticky", confirmed: true });
    expect(feedback).toMatchObject({ tone: "warning" });
    expect(feedback.text).toContain("vps");
  });
});
