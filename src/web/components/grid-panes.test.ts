import { describe, expect, it } from "vitest";
import { GridPanes } from "./grid-panes.ts";
import type { SessionView } from "../../shared/types.ts";

function session(name: string, overrides: Partial<SessionView> = {}): SessionView {
  return { name, origin: "heyterm", projectPath: `/p/${name}`, projectName: name, agent: "claude", state: "idle", stateSince: 0, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0, ...overrides };
}

// Adil, 29 October 2026: three idle VPS sessions he was not using took half the grid. A session in
// his own terminal has no screen here, so it gets a pane only while it needs him or once he picks it.
describe("GridPanes.shown", () => {
  const heyterm = session("heyterm");
  const idleOnVps = session("vps/projects-6", { origin: "external", host: "vps" });
  const asking = session("vps/kernel-cve", { origin: "external", host: "vps", state: "asked" });

  it("gives every session HeyTerm runs a pane, and an idle one in your own terminal none", () => {
    expect(GridPanes.shown([heyterm, idleOnVps], undefined).map((shown) => shown.name)).toEqual(["heyterm"]);
  });

  it("gives a session in your own terminal a pane while it needs you", () => {
    expect(GridPanes.shown([heyterm, idleOnVps, asking], "heyterm").map((shown) => shown.name)).toEqual(["heyterm", "vps/kernel-cve"]);
  });

  it("gives one a pane once it is picked in the sidebar", () => {
    expect(GridPanes.shown([heyterm, idleOnVps], "vps/projects-6").map((shown) => shown.name)).toEqual(["heyterm", "vps/projects-6"]);
  });

  it("names the sessions left out, so the grid can say where they are", () => {
    expect(GridPanes.leftOut([heyterm, idleOnVps, asking], "heyterm").map((left) => left.name)).toEqual(["vps/projects-6"]);
  });
});
