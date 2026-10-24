import { describe, expect, it } from "vitest";
import { VoiceChoice } from "./voice-choice.ts";

describe("VoiceChoice.effective", () => {
  it("uses the Mac's own voice by default when the server can speak with it, so Siri voices work", () => {
    expect(VoiceChoice.effective({ preference: undefined, macVoiceAvailable: true })).toBe("mac");
  });

  it("uses the browser voice where the server cannot speak, such as Linux or the playground", () => {
    expect(VoiceChoice.effective({ preference: undefined, macVoiceAvailable: false })).toBe("browser");
    expect(VoiceChoice.effective({ preference: "mac", macVoiceAvailable: false })).toBe("browser");
  });

  it("keeps the browser voice when the user chose it", () => {
    expect(VoiceChoice.effective({ preference: "browser", macVoiceAvailable: true })).toBe("browser");
  });
});
