// The local server: hook events in, the web UI out, and a WebSocket per terminal pane.

import { existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import sirv from "sirv";
import { WebSocketServer } from "ws";
import { forwardedHookEvents } from "../hooks/hook-installer.ts";
import type { EventHub } from "./event-hub.ts";
import type { RequestGuard } from "./request-guard.ts";
import type { TerminalBridge } from "./terminal-bridge.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { HookEventName } from "../../shared/types.ts";

const largestHookBodyBytes = 2 * 1024 * 1024;
// A page's messages are words and clicks; nothing it sends is this large.
const largestSocketMessageBytes = 256 * 1024;

export class CallsignHttpServer {
  private readonly server = createServer((request, response) => void this.handle(request, response));
  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: largestSocketMessageBytes });
  // Called when someone with the token asks Callsign to stop.
  onShutdownRequest: () => void = () => undefined;
  private readonly serveWeb: ((request: IncomingMessage, response: ServerResponse) => void) | undefined;

  constructor(
    private readonly port: number,
    webDirectory: string,
    private readonly guard: RequestGuard,
    private readonly registry: SessionRegistry,
    private readonly hub: EventHub,
    private readonly terminals: TerminalBridge,
  ) {
    this.serveWeb = existsSync(webDirectory) ? sirv(webDirectory, { single: true }) : undefined;
    this.server.on("upgrade", (request, socket, head) => {
      if (!this.guard.isFromThisMac(request) || !this.guard.hasToken(request)) return socket.destroy();
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      this.sockets.handleUpgrade(request, socket, head, (webSocket) => {
        if (url.pathname === "/ws") return this.hub.connect(webSocket);
        if (url.pathname === "/pty") {
          const columns = Number(url.searchParams.get("columns"));
          const rows = Number(url.searchParams.get("rows"));
          return this.terminals.connect(webSocket, url.searchParams.get("session") ?? "", columns, rows);
        }
        webSocket.close(4404, "unknown path");
      });
    });
  }

  close(): Promise<void> {
    for (const client of this.sockets.clients) client.terminate();
    this.server.closeAllConnections();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      // 127.0.0.1 only: nothing on the network can reach the terminals.
      this.server.listen(this.port, "127.0.0.1", () => resolve());
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.guard.isFromThisMac(request)) return respond(response, 403, "Callsign only answers requests from this Mac.");
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/hooks/") && request.method === "POST") return this.handleHook(request, response, url);
    // Says it is Callsign, so a second "callsign" can tell it is already running.
    if (url.pathname === "/health") return respond(response, 200, JSON.stringify({ ok: true, app: "callsign" }), "application/json");
    if (url.pathname === "/shutdown" && request.method === "POST") {
      if (!this.guard.hasToken(request)) return respond(response, 401, "");
      respond(response, 200, "stopping");
      return this.onShutdownRequest();
    }
    if (this.serveWeb) return this.serveWeb(request, response);
    respond(response, 404, "The web UI is not built yet. Run npm run build, or npm run dev while working on Callsign.");
  }

  private async handleHook(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    if (!this.guard.hasToken(request)) return respond(response, 401, "");
    const eventName = url.pathname.slice("/hooks/".length) as HookEventName;
    const sessionName = url.searchParams.get("session") ?? "";
    const isExternal = url.searchParams.get("external") === "1";
    if (!forwardedHookEvents.includes(eventName) || (!sessionName && !isExternal)) return respond(response, 400, "");
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(await readBody(request, largestHookBodyBytes)) as Record<string, unknown>;
    } catch {
      return respond(response, 400, "");
    }
    const answer = isExternal
      ? await this.registry.applyExternalHookEvent(eventName, payload, Date.now())
      : await this.registry.applyHookEvent({ name: eventName, sessionName, payload, receivedAt: Date.now() });
    respond(response, 200, answer, "application/json");
  }
}

function respond(response: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  if (response.writableEnded) return;
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(body);
}

function readBody(request: IncomingMessage, largestBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > largestBytes) {
        request.destroy();
        reject(new Error("hook body too large"));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}
