// Callsign types into terminals, so only this Mac's own pages and hooks may talk to it.

import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export class RequestGuard {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly port: number,
    private readonly hookToken: string,
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

  hasHookToken(request: IncomingMessage): boolean {
    const presented = Buffer.from(String(request.headers["x-callsign-token"] ?? ""));
    const expected = Buffer.from(this.hookToken);
    return presented.length === expected.length && timingSafeEqual(presented, expected);
  }
}
