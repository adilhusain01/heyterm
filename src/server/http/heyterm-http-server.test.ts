import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { HeyTermHttpServer } from "./heyterm-http-server.ts";
import { PairingTickets } from "./pairing-tickets.ts";
import { RequestGuard } from "./request-guard.ts";
import type { EventHub } from "./event-hub.ts";
import type { TerminalBridge } from "./terminal-bridge.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";

describe("HeyTermHttpServer", () => {
  it("survives a socket message over the size limit, closing only that socket", async () => {
    const port = 47_000 + Math.floor(Math.random() * 1_000);
    const hub = { connect: () => undefined } as unknown as EventHub;
    const server = new HeyTermHttpServer(port, "/no/web", new RequestGuard(port, "token"), {} as SessionRegistry, hub, {} as TerminalBridge, new PairingTickets("token"));
    await server.listen();
    const closeCode = await new Promise<number>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=token`);
      socket.on("open", () => socket.send("x".repeat(1_000_000)));
      socket.on("close", (code) => resolve(code));
      socket.on("error", () => undefined);
    });
    expect(closeCode).toBe(1009);
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
    expect(health).toEqual({ ok: true, app: "heyterm" });
    await server.close();
  });

  it("sends headers that stop other sites framing the page, loading outside scripts or reading the referrer", async () => {
    const port = 48_000 + Math.floor(Math.random() * 1_000);
    const server = new HeyTermHttpServer(port, "/no/web", new RequestGuard(port, "token"), {} as SessionRegistry, {} as EventHub, {} as TerminalBridge, new PairingTickets("token"));
    await server.listen();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    await server.close();
  });

  it("trades a fresh pairing ticket for the token once, and only issues tickets to token holders", async () => {
    const port = 49_000 + Math.floor(Math.random() * 1_000);
    const tickets = new PairingTickets("token");
    const server = new HeyTermHttpServer(port, "/no/web", new RequestGuard(port, "token"), {} as SessionRegistry, {} as EventHub, {} as TerminalBridge, tickets);
    await server.listen();
    const base = `http://127.0.0.1:${port}`;
    expect((await fetch(`${base}/ticket`, { method: "POST" })).status).toBe(401);
    const { ticket } = await (await fetch(`${base}/ticket`, { method: "POST", headers: { "X-HeyTerm-Token": "token" } })).json();
    const pair = (body: unknown) => fetch(`${base}/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect(await (await pair({ ticket })).json()).toEqual({ token: "token" });
    expect((await pair({ ticket })).status).toBe(401);
    expect((await pair({ ticket: "guess" })).status).toBe(401);
    await server.close();
  });
});
