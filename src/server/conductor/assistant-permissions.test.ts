import { describe, expect, it } from "vitest";
import { AssistantPermissions } from "./assistant-permissions.ts";

describe("AssistantPermissions.mode", () => {
  it("asks when Claude Code would, unless the developer chose full access", () => {
    expect(AssistantPermissions.mode(undefined)).toBe("auto");
    expect(AssistantPermissions.mode("ask")).toBe("auto");
  });

  // Adil, 27 October 2026: the assistant should have every permission.
  it("never asks with full access", () => {
    expect(AssistantPermissions.mode("full")).toBe("bypassPermissions");
  });
});
