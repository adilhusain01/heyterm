import { describe, expect, it } from "vitest";
import { ConversationOwner } from "./conversation-owner.ts";

describe("ConversationOwner.stopCommand", () => {
  // Seen on the VPS, 28 October 2026: Open here sent SIGTERM to a background session, Claude's daemon
  // started it again, and after Adil closed HeyTerm's copy it came back under a new name.
  it("stops a background session through Claude's own command, which its daemon respects", () => {
    expect(ConversationOwner.stopCommand({ sessionId: "4450a7ab-0495-4f71-89f0-e030c0c93e9d", pid: 1, kind: "bg" })).toEqual({ program: "claude", args: ["stop", "4450a7ab-0495-4f71-89f0-e030c0c93e9d"] });
  });

  it("leaves a session in a terminal to be ended by a signal, as before", () => {
    expect(ConversationOwner.stopCommand({ sessionId: "x", pid: 1, kind: "interactive" })).toBeUndefined();
  });
});
