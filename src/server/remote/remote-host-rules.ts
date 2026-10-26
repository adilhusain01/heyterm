// Sessions on another computer's HeyTerm (a VPS reached over Tailscale), shown here under that
// computer's name: "vps/voice-sticky". The other HeyTerm owns them, their hooks and their held
// requests; this one mirrors what it reports and sends it what you do. Pure.

import type { ClosedSessionView } from "../../shared/protocol.ts";
import type { RouterAction, SessionView } from "../../shared/types.ts";

export interface RemoteHost {
  name: string;
  url: string;
  token: string;
}

type SessionAction = Extract<RouterAction, { session: string }>;

// Actions the other HeyTerm carries out; anything else (focus, status, catch up) is answered here
// from the mirrored state.
const forwardedTypes = new Set<RouterAction["type"]>(["send", "answer", "approve", "deny", "trust", "interrupt", "close", "resume", "rename", "forget_closed", "adopt"]);
const hostNamePattern = /^[a-z0-9][a-z0-9-]{0,19}$/;
const localHostNames = new Set(["127.0.0.1", "localhost", "[::1]"]);

export class RemoteHostRules {
  static mirroredName(host: string, name: string): string {
    return `${host}/${name}`;
  }

  static split(name: string): { host: string; name: string } | undefined {
    const slash = name.indexOf("/");
    if (slash <= 0) return undefined;
    return { host: name.slice(0, slash), name: name.slice(slash + 1) };
  }

  static mirror(host: string, session: SessionView): SessionView {
    return { ...session, name: RemoteHostRules.mirroredName(host, session.name), host, faceSeed: session.faceSeed ?? session.name };
  }

  static mirrorClosed(host: string, closed: ClosedSessionView): SessionView {
    return {
      name: RemoteHostRules.mirroredName(host, closed.name),
      host,
      origin: closed.origin,
      projectPath: closed.projectPath ?? "",
      projectName: closed.projectName,
      agent: closed.agent ?? "claude",
      state: "stopped",
      stateSince: closed.closedAt ?? 0,
      createdAt: closed.createdAt ?? 0,
      lastSeenAt: closed.closedAt ?? 0,
      agentSessionId: closed.agentSessionId,
      faceSeed: closed.faceSeed ?? closed.name,
      worktree: closed.worktree,
      activitySinceSeen: [],
      waitedMillisecondsToday: 0,
    };
  }

  // The action as the other HeyTerm should see it: its own session name, and confirmed, because any
  // preview or "say confirm" already happened on this computer.
  static forwardedAction(action: RouterAction): RouterAction | undefined {
    if (!forwardedTypes.has(action.type) || !("session" in action) || typeof action.session !== "string") return undefined;
    const split = RemoteHostRules.split(action.session);
    if (!split) return undefined;
    const forwarded = { ...(action as SessionAction), session: split.name } as RouterAction;
    if (forwarded.type === "send") return { ...forwarded, needsPreview: false };
    if (forwarded.type === "approve" || forwarded.type === "close" || forwarded.type === "adopt") return { ...forwarded, confirmed: true };
    return forwarded;
  }

  // ~/.heyterm/remotes.json. The token travels in the socket's address, so only an https address, or
  // one on this computer, is accepted.
  static readRemotes(text: string): RemoteHost[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is RemoteHost => RemoteHostRules.isUsable(entry)).map(({ name, url, token }) => ({ name, url, token }));
  }

  static socketUrl(baseUrl: string, pathAndQuery: string, token: string): string {
    const url = new URL(pathAndQuery, baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", token);
    return url.toString();
  }

  private static isUsable(entry: unknown): boolean {
    if (typeof entry !== "object" || entry === null) return false;
    const { name, url, token } = entry as Record<string, unknown>;
    if (typeof name !== "string" || !hostNamePattern.test(name) || typeof token !== "string" || !token || typeof url !== "string") return false;
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "https:" || (parsedUrl.protocol === "http:" && localHostNames.has(parsedUrl.hostname));
    } catch {
      return false;
    }
  }
}
