import { describe, expect, it } from "vitest";
import { GlobalAgentHooks } from "./global-agent-hooks.ts";

const script = "/data/heyterm-forward.cjs";

describe("GlobalAgentHooks, for Grok Build", () => {
  it("writes a hook file of HeyTerm's own, tagged so it only ever reports Grok's events", () => {
    const file = GlobalAgentHooks.grokHookFile(script) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
    expect(Object.keys(file.hooks)).toEqual(expect.arrayContaining(["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "StopCancelled", "StopFailure", "Notification", "SessionEnd"]));
    expect(file.hooks.Stop?.[0]?.hooks[0]?.command).toBe('node "/data/heyterm-forward.cjs" agent Stop grok');
  });

  it("never registers a permission hook, so Grok's own permission card stays in charge", () => {
    const file = GlobalAgentHooks.grokHookFile(script) as { hooks: Record<string, unknown> };
    expect(file.hooks).not.toHaveProperty("PermissionRequest");
  });
});

describe("GlobalAgentHooks, for Cursor", () => {
  const usersOwn = { version: 1, hooks: { afterFileEdit: [{ command: "./format.sh" }], stop: [{ command: "./audit.sh" }] } };

  it("adds HeyTerm's hooks next to the user's own, leaving theirs as they were", () => {
    const merged = GlobalAgentHooks.cursorWithHeyTerm(usersOwn, script) as typeof usersOwn & { hooks: Record<string, Array<{ command: string }>> };
    expect(merged.hooks.afterFileEdit).toEqual([{ command: "./format.sh" }]);
    expect(merged.hooks.stop?.[0]).toEqual({ command: "./audit.sh" });
    expect(merged.hooks.stop?.[1]?.command).toBe('node "/data/heyterm-forward.cjs" agent stop cursor');
    expect(merged.version).toBe(1);
  });

  it("leaves no hook that could approve or block anything, only ones that report", () => {
    const merged = GlobalAgentHooks.cursorWithHeyTerm({}, script) as { hooks: Record<string, unknown> };
    for (const deciding of ["preToolUse", "beforeShellExecution", "beforeMCPExecution", "beforeReadFile"]) expect(merged.hooks).not.toHaveProperty(deciding);
  });

  it("takes out exactly what it added", () => {
    expect(GlobalAgentHooks.cursorWithoutHeyTerm(GlobalAgentHooks.cursorWithHeyTerm(usersOwn, script))).toEqual(usersOwn);
  });

  it("adds its hooks once however often it runs", () => {
    const twice = GlobalAgentHooks.cursorWithHeyTerm(GlobalAgentHooks.cursorWithHeyTerm(usersOwn, script), script) as { hooks: Record<string, unknown[]> };
    expect(twice.hooks.stop).toHaveLength(2);
  });

  it("leaves an empty file as nothing when HeyTerm's hooks were all there was", () => {
    expect(GlobalAgentHooks.cursorWithoutHeyTerm(GlobalAgentHooks.cursorWithHeyTerm({}, script))).toEqual({ version: 1 });
  });
});
