// The local server: hook events in, the web UI out, and a WebSocket per terminal pane.

import { existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import sirv from "sirv";
import { WebSocketServer, type WebSocket } from "ws";
import { AttachmentRules } from "../attachments/attachment-rules.ts";
import { forwardedHookEvents } from "../hooks/hook-installer.ts";
import type { EventHub } from "./event-hub.ts";
import type { PairingTickets } from "./pairing-tickets.ts";
import type { RequestGuard } from "./request-guard.ts";
import type { TerminalBridge } from "./terminal-bridge.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { HookEventName } from "../../shared/types.ts";

const largestHookBodyBytes = 2 * 1024 * 1024;
// A page's messages are words and clicks; nothing it sends is this large.
const largestSocketMessageBytes = 256 * 1024;
// Browsers answer pings on their own; a socket that misses one went away without closing.
const defaultHeartbeatMilliseconds = 30_000;

export class HeyTermHttpServer {
  private readonly server = createServer((request, response) => void this.handle(request, response));
  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: largestSocketMessageBytes });
  // Called when someone with the token asks HeyTerm to stop.
  onShutdownRequest: () => void = () => undefined;
  // Saves an image for a session and gives it to that session; main.ts sets it.
  onAttachment: (sessionName: string, bytes: Buffer, contentType: string) => Promise<{ ok: boolean; text: string }> = async () => ({ ok: false, text: "Attachments are not set up." });
  private readonly serveWeb: ((request: IncomingMessage, response: ServerResponse) => void) | undefined;
  private readonly socketsThatAnswered = new WeakSet<WebSocket>();
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor(
    private readonly port: number,
    webDirectory: string,
    private readonly guard: RequestGuard,
    private readonly registry: SessionRegistry,
    private readonly hub: EventHub,
    private readonly terminals: TerminalBridge,
    private readonly tickets: PairingTickets,
    options: { heartbeatMilliseconds?: number } = {},
  ) {
    // dev reads files from disk on every request instead of listing them once at start, so an update
    // while HeyTerm runs serves the new page, which then asks for a restart, rather than a blank page.
    this.serveWeb = existsSync(webDirectory) ? sirv(webDirectory, { dev: true, single: true, setHeaders: cachingHeaders }) : undefined;
    this.server.on("upgrade", (request, socket, head) => {
      if (!this.guard.isFromThisMac(request) || !this.guard.hasToken(request)) return socket.destroy();
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      this.sockets.handleUpgrade(request, socket, head, (webSocket) => {
        // A bad frame (too large, malformed) makes ws close that one socket with a reason. Without a
        // listener, the same error would end the whole server.
        webSocket.on("error", () => undefined);
        this.socketsThatAnswered.add(webSocket);
        webSocket.on("pong", () => this.socketsThatAnswered.add(webSocket));
        if (url.pathname === "/ws") return this.hub.connect(webSocket);
        if (url.pathname === "/pty") {
          const columns = Number(url.searchParams.get("columns"));
          const rows = Number(url.searchParams.get("rows"));
          return this.terminals.connect(webSocket, url.searchParams.get("session") ?? "", columns, rows);
        }
        webSocket.close(4404, "unknown path");
      });
    });
    this.heartbeatTimer = setInterval(() => this.dropSocketsThatStoppedAnswering(), options.heartbeatMilliseconds ?? defaultHeartbeatMilliseconds);
    this.heartbeatTimer.unref();
  }

  // Ending such a socket detaches its pane from the terminal, so output stops piling up for it.
  private dropSocketsThatStoppedAnswering(): void {
    for (const client of this.sockets.clients) {
      if (!this.socketsThatAnswered.has(client)) {
        client.terminate();
        continue;
      }
      this.socketsThatAnswered.delete(client);
      client.ping();
    }
  }

  close(): Promise<void> {
    clearInterval(this.heartbeatTimer);
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
    for (const [name, value] of Object.entries(securityHeaders(this.port))) response.setHeader(name, value);
    if (!this.guard.isFromThisMac(request)) return respond(response, 403, "HeyTerm only answers requests from this Mac.");
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    // The heyterm command gets a ticket with the token, and the page trades it for the token.
    if (url.pathname === "/ticket" && request.method === "POST") {
      if (!this.guard.hasToken(request)) return respond(response, 401, "");
      return respond(response, 200, JSON.stringify({ ticket: this.tickets.issue() }), "application/json");
    }
    if (url.pathname === "/pair" && request.method === "POST") {
      const body = await readBody(request, 4_096).catch(() => "");
      const ticket = (safeJson(body) as { ticket?: unknown } | undefined)?.ticket;
      const token = typeof ticket === "string" ? this.tickets.redeem(ticket) : undefined;
      return token ? respond(response, 200, JSON.stringify({ token }), "application/json") : respond(response, 401, "");
    }
    if (url.pathname.startsWith("/hooks/") && request.method === "POST") return this.handleHook(request, response, url);
    if (url.pathname === "/attachments" && request.method === "POST") return this.handleAttachment(request, response, url);
    // Says it is HeyTerm, so a second "heyterm" can tell it is already running.
    if (url.pathname === "/health") return respond(response, 200, JSON.stringify({ ok: true, app: "heyterm" }), "application/json");
    if (url.pathname === "/shutdown" && request.method === "POST") {
      if (!this.guard.hasToken(request)) return respond(response, 401, "");
      respond(response, 200, "stopping");
      return this.onShutdownRequest();
    }
    if (this.serveWeb) return this.serveWeb(request, response);
    respond(response, 404, "The web UI is not built yet. Run npm run build, or npm run dev while working on HeyTerm.");
  }

  // An image dropped or pasted onto a session's pane, as raw bytes with its type.
  private async handleAttachment(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    if (!this.guard.hasToken(request)) return respond(response, 401, "");
    const contentType = String(request.headers["content-type"] ?? "");
    if (!AttachmentRules.extensionFor(contentType)) return respond(response, 415, JSON.stringify({ ok: false, text: "Only PNG, JPEG, GIF and WebP images can be attached." }), "application/json");
    const bytes = await readBytes(request, AttachmentRules.largestBytes).catch(() => undefined);
    if (!bytes) return respond(response, 413, JSON.stringify({ ok: false, text: "That image is over 20 MB." }), "application/json");
    const result = await this.onAttachment(url.searchParams.get("session") ?? "", bytes, contentType);
    respond(response, result.ok ? 200 : 409, JSON.stringify(result), "application/json");
  }

  private async handleHook(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    if (!this.guard.hasToken(request)) return respond(response, 401, "");
    const eventName = url.pathname.slice("/hooks/".length) as HookEventName;
    const agent = url.searchParams.get("agent");
    if (agent === "grok" || agent === "cursor") return this.handleAgentHook(request, response, agent, eventName);
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

  // Grok Build and Cursor name events their own way; the registry translates them.
  private async handleAgentHook(request: IncomingMessage, response: ServerResponse, agent: "grok" | "cursor", eventName: string): Promise<void> {
    if (!/^[A-Za-z]+$/.test(eventName)) return respond(response, 400, "");
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(await readBody(request, largestHookBodyBytes)) as Record<string, unknown>;
    } catch {
      return respond(response, 400, "");
    }
    respond(response, 200, await this.registry.applyAgentHookEvent(agent, eventName, payload, Date.now()), "application/json");
  }
}

// Built assets carry a content hash in their name, so they never change and are kept. Everything else
// (the page, the theme script, the icon) is checked on every load, so an update shows at once.
function cachingHeaders(response: ServerResponse, pathname: string): void {
  response.setHeader("Cache-Control", pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
}

// No framing by other sites (clickjacking), no scripts or connections but HeyTerm's own, no referrer.
function securityHeaders(port: number): Record<string, string> {
  const ownSockets = `ws://127.0.0.1:${port} ws://localhost:${port}`;
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data:",
      `connect-src 'self' ${ownSockets}`,
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function respond(response: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  if (response.writableEnded) return;
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(body);
}

function readBytes(request: IncomingMessage, largestBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > largestBytes) {
        // Read on without keeping it, so the answer still reaches the page.
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => (size > largestBytes ? reject(new Error("body too large")) : resolve(Buffer.concat(chunks))));
    request.on("error", reject);
  });
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
