import { describe, expect, it } from "vitest";
import { SessionLauncher } from "./session-launcher.ts";
import { SessionRegistry } from "./session-registry.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { StateStore } from "./state-store.ts";
import type { TerminalHost } from "../terminals/terminal-host.ts";
import type { SessionView } from "../../shared/types.ts";

function session(name: string, overrides: Partial<SessionView> = {}): SessionView {
  return { name, origin: "heyterm", projectPath: `/p/${name}`, projectName: name, agent: "claude", state: "working", stateSince: 0, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0, ...overrides };
}

function launcherWith(registry: SessionRegistry): SessionLauncher {
  const host = { on: () => undefined, shutdown: () => undefined } as unknown as TerminalHost;
  return new SessionLauncher(host, registry, { claudeSettingsPath: "", forwardScriptPath: "" });
}

describe("SessionLauncher with sessions from another computer", () => {
  // Seen on 26 October 2026: stopping the Mac's HeyTerm put vps/voice-sticky-2 in the Mac's own
  // closed list, so it showed twice once the VPS reported it closed too.
  it("closes only this computer's sessions when HeyTerm stops or starts", () => {
    const registry = new SessionRegistry({ save: async () => undefined } as unknown as StateStore, { letGoAllFor: () => undefined } as unknown as HeldHookRequests);
    registry.add(session("whisker"));
    registry.replaceHostSessions("vps", [session("vps/voice-sticky", { host: "vps" })], []);
    const launcher = launcherWith(registry);
    launcher.shutdown();
    expect(registry.recentlyClosedSessions().map((closed) => closed.name)).toEqual(["whisker"]);
    launcher.restoreAfterStart();
    expect(registry.list().map((open) => open.name)).toEqual(["vps/voice-sticky"]);
  });
});
