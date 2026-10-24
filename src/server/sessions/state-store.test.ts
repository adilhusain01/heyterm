import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { StateStore } from "./state-store.ts";

describe("StateStore.load", () => {
  it("reads the session id an older Callsign saved as claudeSessionId", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "callsign-state-"));
    await writeFile(path.join(folder, "state.json"), JSON.stringify({ sessions: [{ name: "web", claudeSessionId: "abc" }], recentlyClosed: [{ name: "api", claudeSessionId: "def" }] }));
    const state = await new StateStore(folder).load();
    expect(state.sessions[0]?.agentSessionId).toBe("abc");
    expect(state.recentlyClosed[0]?.agentSessionId).toBe("def");
  });

  it("treats a saved session without an agent as Claude Code, as every session was before", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "callsign-state-"));
    await writeFile(path.join(folder, "state.json"), JSON.stringify({ sessions: [{ name: "web" }], recentlyClosed: [] }));
    expect((await new StateStore(folder).load()).sessions[0]?.agent).toBe("claude");
  });
});
