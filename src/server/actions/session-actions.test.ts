import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SessionActions } from "./session-actions.ts";
import { SessionRegistry } from "../sessions/session-registry.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { ProjectCatalog } from "../projects/project-catalog.ts";
import type { RemoteSessionGateway } from "../remote/remote-gateway.ts";
import type { AuditLog } from "../safety/audit-log.ts";
import type { SessionLauncher } from "../sessions/session-launcher.ts";
import type { StateStore } from "../sessions/state-store.ts";
import type { AgentKind, SessionView } from "../../shared/types.ts";

function session(name: string, overrides: Partial<SessionView> = {}): SessionView {
  return { name, origin: "heyterm", projectPath: `/p/${name}`, projectName: name, agent: "claude", state: "idle", stateSince: 0, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0, ...overrides };
}

// The parts a new session goes through, with a launcher that records what it was asked to start.
function setup(projects: Record<string, string> = {}) {
  const registry = new SessionRegistry({ save: async () => undefined } as unknown as StateStore, { letGoAllFor: () => undefined } as unknown as HeldHookRequests);
  const started: Array<{ projectPath: string; agent?: AgentKind; sharedFolder?: boolean }> = [];
  const launcher = {
    start: vi.fn(async (projectPath: string, projectName: string, task?: string, agent?: AgentKind, options: { sharedFolder?: boolean } = {}) => {
      started.push({ projectPath, ...(agent ? { agent } : {}), ...(options.sharedFolder ? { sharedFolder: true } : {}) });
      // Named as the real launcher names it: a second session in a folder gets a number.
      const baseName = agent === "shell" ? `${projectName}-terminal` : projectName;
      const made = session(registry.get(baseName) ? `${baseName}-2` : baseName, { projectPath, agent: agent ?? "claude" });
      registry.add(made);
      return made;
    }),
  } as unknown as SessionLauncher;
  const catalog = { find: async (name: string) => (projects[name] ? { name, path: projects[name] } : undefined) } as unknown as ProjectCatalog;
  const actions = new SessionActions(registry, launcher, catalog, { record: async () => undefined } as unknown as AuditLog);
  return { registry, actions, started };
}

describe("SessionActions starting a session", () => {
  // Adil, 27 October 2026: open a terminal at any place he names.
  it("finds a folder named out loud in the home folder when it is not a project", async () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "heyterm-home-"));
    mkdirSync(path.join(home, "Downloads"));
    const { actions, started } = setup();
    actions.homeFolder = home;
    const feedback = await actions.perform({ type: "spawn", project: "downloads", agent: "shell" }, () => undefined);
    expect(started).toEqual([{ projectPath: path.join(home, "Downloads"), agent: "shell" }]);
    expect(feedback.text).toContain("Opened a terminal");
  });

  it("asks which one when several folders have that name", async () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "heyterm-home-"));
    mkdirSync(path.join(home, "Work", "site"), { recursive: true });
    mkdirSync(path.join(home, "Clients", "site"), { recursive: true });
    const { actions, started } = setup();
    actions.homeFolder = home;
    const feedback = await actions.perform({ type: "spawn", project: "site" }, () => undefined);
    expect(started).toEqual([]);
    expect(feedback.text).toContain(path.join(home, "Clients", "site"));
    expect(feedback.text).toContain(path.join(home, "Work", "site"));
  });

  it("starts in the same folder as another session when asked, and says they share it", async () => {
    const { registry, actions, started } = setup({ whisker: "/p/whisker" });
    registry.add(session("whisker", { projectPath: "/p/whisker", state: "working" }));
    const feedback = await actions.perform({ type: "spawn", project: "whisker", sharedFolder: true }, () => undefined);
    expect(started).toEqual([{ projectPath: "/p/whisker", sharedFolder: true }]);
    expect(feedback.text).toContain("same folder");
    expect(feedback.text).not.toContain("not a git repository");
  });

  it("sends a new session to the computer it names", async () => {
    const { actions, started } = setup();
    const perform = vi.fn(async () => ({ text: "Opened a terminal in notes, called notes-terminal.", tone: "success" as const, speak: false }));
    actions.useRemoteHosts({ isRemote: () => false, hasHost: (host: string) => host === "vps", perform, readScreen: async () => "" } as RemoteSessionGateway);
    const feedback = await actions.perform({ type: "spawn", project: "~/notes", agent: "shell", host: "vps" }, () => undefined);
    expect(perform).toHaveBeenCalledWith({ type: "spawn", project: "~/notes", agent: "shell", host: "vps" });
    expect(started).toEqual([]);
    expect(feedback.text).toContain("on vps");
  });

  it("says so when the computer it names is not one HeyTerm knows", async () => {
    const { actions } = setup();
    const feedback = await actions.perform({ type: "spawn", project: "notes", host: "laptop" }, () => undefined);
    expect(feedback).toMatchObject({ tone: "warning" });
    expect(feedback.text).toContain("heyterm remote add");
  });
});
