import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { CallsignHttpServer } from "./callsign-http-server.ts";
import { RequestGuard } from "./request-guard.ts";
import type { EventHub } from "./event-hub.ts";
import type { TerminalBridge } from "./terminal-bridge.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";

describe("CallsignHttpServer", () => {
  it("survives a socket message over the size limit, closing only that socket", async () => {
    const port = 47_000 + Math.floor(Math.random() * 1_000);
    const hub = { connect: () => undefined } as unknown as EventHub;
    const server = new CallsignHttpServer(port, "/no/web", new RequestGuard(port, "token"), {} as SessionRegistry, hub, {} as TerminalBridge);
    await server.listen();
    const closeCode = await new Promise<number>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=token`);
      socket.on("open", () => socket.send("x".repeat(1_000_000)));
      socket.on("close", (code) => resolve(code));
      socket.on("error", () => undefined);
    });
    expect(closeCode).toBe(1009);
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
    expect(health).toEqual({ ok: true, app: "callsign" });
    await server.close();
  });
});
