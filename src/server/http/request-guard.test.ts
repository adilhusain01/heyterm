import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { RequestGuard } from "./request-guard.ts";

const guard = new RequestGuard(4747, "the-token");

function request(url: string, headers: Record<string, string>): IncomingMessage {
  return { url, headers } as unknown as IncomingMessage;
}

describe("RequestGuard", () => {
  it("lets this computer's own page in", () => {
    expect(guard.isFromThisMac(request("/", { host: "127.0.0.1:4747", origin: "http://127.0.0.1:4747" }))).toBe(true);
  });

  it("refuses another website, a rebound DNS name and a cross-site fetch", () => {
    expect(guard.isFromThisMac(request("/", { host: "127.0.0.1:4747", origin: "https://evil.example" }))).toBe(false);
    expect(guard.isFromThisMac(request("/", { host: "evil.example:4747" }))).toBe(false);
    expect(guard.isFromThisMac(request("/", { host: "127.0.0.1:4747", "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("opens the sockets only with the token, from the page's address or a header", () => {
    expect(guard.hasToken(request("/ws?token=the-token", { host: "127.0.0.1:4747" }))).toBe(true);
    expect(guard.hasToken(request("/hooks/Stop", { host: "127.0.0.1:4747", "x-heyterm-token": "the-token" }))).toBe(true);
    expect(guard.hasToken(request("/ws", { host: "127.0.0.1:4747" }))).toBe(false);
    expect(guard.hasToken(request("/ws?token=the-tokeN", { host: "127.0.0.1:4747" }))).toBe(false);
  });

  // On a VPS, Tailscale's serve passes requests on to 127.0.0.1 with the VPS's own Tailscale name as
  // the Host. Another HeyTerm connects with no page, so it sends no Origin.
  it("lets another HeyTerm in through a host name it was told to accept, and nothing else through it", () => {
    const remoteGuard = new RequestGuard(4747, "the-token", undefined, ["vps.example.ts.net"]);
    expect(remoteGuard.isFromThisMac(request("/ws", { host: "vps.example.ts.net:8443" }))).toBe(true);
    expect(remoteGuard.isFromThisMac(request("/ws", { host: "vps.example.ts.net:8443", origin: "https://evil.example" }))).toBe(false);
    expect(remoteGuard.isFromThisMac(request("/ws", { host: "other.example.ts.net:8443" }))).toBe(false);
    expect(guard.isFromThisMac(request("/ws", { host: "vps.example.ts.net:8443" }))).toBe(false);
  });
});
