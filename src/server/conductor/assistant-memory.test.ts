import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AssistantMemory } from "./assistant-memory.ts";

const folder = () => mkdtempSync(path.join(os.tmpdir(), "heyterm-assistant-"));

describe("AssistantMemory", () => {
  // Adil, 25 October 2026: the assistant should do all Claude Code can, and Claude Code remembers
  // a conversation across restarts.
  it("keeps the assistant's conversation id and the lines shown, across a restart", () => {
    const dataDirectory = folder();
    const before = new AssistantMemory(dataDirectory);
    before.rememberSession("session-123");
    before.rememberEntries([{ id: 4, at: 10, kind: "user", text: "what time is it in Germany?" }]);
    const after = new AssistantMemory(dataDirectory);
    expect(after.sessionId()).toBe("session-123");
    expect(after.entries()).toEqual([{ id: 4, at: 10, kind: "user", text: "what time is it in Germany?" }]);
  });

  it("forgets a conversation that could not be resumed", () => {
    const memory = new AssistantMemory(folder());
    memory.rememberSession("gone");
    memory.forgetSession();
    expect(memory.sessionId()).toBeUndefined();
  });

  it("starts empty when the file is missing or unreadable", () => {
    const dataDirectory = folder();
    expect(new AssistantMemory(dataDirectory).entries()).toEqual([]);
    writeFileSync(path.join(dataDirectory, "assistant.json"), "{ not json");
    expect(new AssistantMemory(dataDirectory).sessionId()).toBeUndefined();
  });
});
