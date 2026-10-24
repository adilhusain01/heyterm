import { describe, expect, it } from "vitest";
import { messageVoiceHint } from "./session-display.ts";

describe("messageVoiceHint", () => {
  it("offers a spoken reply to a question from a session Callsign runs", () => {
    expect(messageVoiceHint({ name: "portfolio" }, "question")).toBe("Answer out loud, or say portfolio and your reply");
  });

  it("sends a question from the user's own terminal back there, because Callsign cannot type into it", () => {
    expect(messageVoiceHint({ name: "whisker", origin: "external" }, "question")).toBe("Reply in your own terminal");
  });

  it("offers going to the session or catching up for anything else", () => {
    expect(messageVoiceHint({ name: "portfolio" }, "finished")).toBe("Say go to portfolio, or catch me up");
    expect(messageVoiceHint({ name: "whisker", origin: "external" }, "finished")).toBe("Say go to whisker, or catch me up");
  });
});
