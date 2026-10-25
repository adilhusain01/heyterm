import { describe, expect, it } from "vitest";
import { agentTag, messageVoiceHint } from "./session-display.ts";

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
