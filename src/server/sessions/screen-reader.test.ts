import { describe, expect, it } from "vitest";
import { ScreenReader } from "./screen-reader.ts";

// Captured from Claude Code 2.1.310 on 24 October 2026.
const trustDialogScreen = `
 Accessing workspace:
 /private/tmp/probe/work
 Quick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open source project, or work from your team). If not,
 take a moment to review what's in this folder first.
 Claude Code'll be able to read, edit, and execute files here.
 Security guide
 ❯ No, exit
   Yes, I trust this folder
 Enter to confirm · Esc to cancel
`;

const readyPromptScreen = `
 ▐▛███▛█   Claude Code v2.1.310
──────────────────────────────────── probe-one ─
❯ Try "how do I log an error?"
────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle)
`;

// Captured from Codex 0.164.0 on 25 October 2026.
const codexTrustDialogScreen = `
 Folder access
 /private/tmp/claude-501/scratchpad/projects/demo

 Trust this folder? Codex can read, edit, and run files here, subject to
 your permission settings. Folder settings can run code automatically,
 even without a model request. Continue only if you trust these files.
 Your trust decision will be saved.

› 1. Trust and continue
  2. Quit

 enter continue · esc quit
`;

// Captured from Codex 0.164.0 on 25 October 2026, the first time Callsign's hooks ran.
const codexHookReviewScreen = `
 Hooks need review
 7 hooks are new or changed.
 Hooks can run outside the sandbox after you trust them.


› 1. Review hooks
  2. Trust all and continue
  3. Continue without trusting (hooks won't run)

 enter confirm · esc skip
`;

describe("ScreenReader.trustDialogKeys", () => {
  it("trusts Codex's new hooks by moving to Trust all and continue", () => {
    expect(ScreenReader.trustDialogKeys(codexHookReviewScreen)).toEqual(["Down", "Enter"]);
  });

  it("tells a folder trust dialog from a hook review", () => {
    expect(ScreenReader.trustSubject(codexHookReviewScreen)).toBe("hooks");
    expect(ScreenReader.trustSubject(codexTrustDialogScreen)).toBe("folder");
    expect(ScreenReader.trustSubject(trustDialogScreen)).toBe("folder");
  });

  it("confirms Codex's trust dialog, whose trust option is selected from the start", () => {
    expect(ScreenReader.trustDialogKeys(codexTrustDialogScreen)).toEqual(["Enter"]);
  });

  it("moves to Codex's trust option when Quit is selected", () => {
    const quitSelected = codexTrustDialogScreen.replace("› 1. Trust and continue\n  2. Quit", "  1. Trust and continue\n› 2. Quit");
    expect(ScreenReader.trustDialogKeys(quitSelected)).toEqual(["Up", "Enter"]);
  });

  it("moves from the selected line to the trust option and confirms", () => {
    expect(ScreenReader.trustDialogKeys(trustDialogScreen)).toEqual(["Down", "Enter"]);
  });

  it("only confirms when the trust option is already selected", () => {
    const selected = trustDialogScreen.replace(" ❯ No, exit\n   Yes,", "   No, exit\n ❯ Yes,");
    expect(ScreenReader.trustDialogKeys(selected)).toEqual(["Enter"]);
  });

  it("moves up when the trust option sits above the selection", () => {
    const reordered = trustDialogScreen.replace(" ❯ No, exit\n   Yes, I trust this folder", "   Yes, I trust this folder\n ❯ No, exit");
    expect(ScreenReader.trustDialogKeys(reordered)).toEqual(["Up", "Enter"]);
  });

  it("finds no dialog on a ready prompt", () => {
    expect(ScreenReader.trustDialogKeys(readyPromptScreen)).toBeUndefined();
  });

  it("finds no dialog when the trust question text is there but no option is", () => {
    expect(ScreenReader.trustDialogKeys("Is this a project you created or one you trust?")).toBeUndefined();
  });
});
