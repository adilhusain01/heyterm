// Callsign types into terminals, so only this Mac's own pages and hooks may talk to it.

import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export class RequestGuard {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly port: number,
    private readonly token: string,
    developmentOrigin?: string,
  ) {
    this.allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
    if (developmentOrigin) this.allowedOrigins.add(developmentOrigin);
  }

  // Refuses a request whose Host is not this Mac (DNS rebinding) or whose Origin is another site.
  isFromThisMac(request: IncomingMessage): boolean {
    const host = request.headers.host ?? "";
    const hostName = host.replace(/:\d+$/, "");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostName)) return false;
    const origin = request.headers.origin;
    if (origin && !this.allowedOrigins.has(origin)) return false;
    const fetchSite = request.headers["sec-fetch-site"];
    return fetchSite !== "cross-site";
  }

  // The secret in ~/.callsign/token (readable by this user only). Hooks send it as a header; the page,
  // which cannot set headers on a WebSocket, sends it in the address. Another user on the same
  // computer can reach 127.0.0.1 but cannot read the token, so cannot type into these terminals.
  hasToken(request: IncomingMessage): boolean {
    const fromAddress = new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("token");
    const presented = Buffer.from(String(request.headers["x-callsign-token"] ?? fromAddress ?? ""));
    const expected = Buffer.from(this.token);
    return presented.length === expected.length && timingSafeEqual(presented, expected);
  }
}
