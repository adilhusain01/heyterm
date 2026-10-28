import { describe, expect, it } from "vitest";
import { agentTag, displayFor, messageVoiceHint } from "./session-display.ts";

describe("messageVoiceHint", () => {
  it("offers a spoken reply to a question from a session HeyTerm runs", () => {
    expect(messageVoiceHint({ name: "portfolio" }, "question")).toBe("Answer out loud, or say portfolio and your reply");
  });

  it("sends a question from the user's own terminal back there, because HeyTerm cannot type into it", () => {
    expect(messageVoiceHint({ name: "whisker", origin: "external" }, "question")).toBe("Reply in your own terminal");
  });

  it("offers going to the session or catching up for anything else", () => {
    expect(messageVoiceHint({ name: "portfolio" }, "finished")).toBe("Say go to portfolio, or catch me up");
    expect(messageVoiceHint({ name: "whisker", origin: "external" }, "finished")).toBe("Say go to whisker, or catch me up");
  });
});

describe("agentTag", () => {
  it("tags a session by its agent beside its name, a terminal as a terminal, and Claude Code with nothing", () => {
    expect(agentTag("shell")).toBe("terminal");
    expect(agentTag("codex")).toBe("codex");
    expect(agentTag("claude")).toBeUndefined();
  });
});

describe("displayFor", () => {
  it("shows a session by its state", () => {
    expect(displayFor({ state: "working" }).label).toBe("Working");
  });

  // Its last state could be minutes old, so it is not shown as current.
  it("says a session on a computer HeyTerm cannot reach is not reachable, and does not ask for you", () => {
    const display = displayFor({ state: "needs_permission", host: "vps", hostUnreachable: true });
    expect(display.label).toBe("vps not reachable");
    expect(display.needsYou).toBe(false);
  });
});

describe("agentTag for a terminal with Claude running in it", () => {
  it("tags it claude, since that is what answers there now", () => {
    expect(agentTag("shell", { claudeInside: true })).toBe("claude");
    expect(agentTag("shell")).toBe("terminal");
  });
});
