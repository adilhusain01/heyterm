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

describe("ScreenReader.trustDialogKeys", () => {
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
