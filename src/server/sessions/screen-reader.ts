// Reads an agent's screen for the one dialog no hook reports: trusting a new folder.

// Claude Code says "Yes, I trust this folder"; Codex says "Trust and continue" for a folder and
// "Trust all and continue" for hooks it has not seen before (Callsign's, the first time).
const trustOptionText = /Yes, I trust this folder|\bTrust (?:all )?and continue\b/;
const hookReviewText = /Hooks need review/;

export type TrustSubject = "folder" | "hooks";
// Claude Code marks the selected option with ❯, Codex with ›.
const selectionMarkers = ["❯", "›"];
// The dialog's options sit together; a marker further away belongs to something else.
const greatestOptionDistance = 4;

export class ScreenReader {
  static trustSubject(screenText: string): TrustSubject {
    return hookReviewText.test(screenText) ? "hooks" : "folder";
  }

  // Keys that select "Yes, I trust this folder" and confirm it, or undefined when the dialog is not showing.
  static trustDialogKeys(screenText: string): string[] | undefined {
    const lines = screenText.split("\n");
    const trustLineIndex = lines.findIndex((line) => trustOptionText.test(line));
    if (trustLineIndex === -1) return undefined;
    const selectedLineIndex = ScreenReader.nearestSelectedLine(lines, trustLineIndex);
    if (selectedLineIndex === undefined) return undefined;
    const distance = trustLineIndex - selectedLineIndex;
    const moveKey = distance > 0 ? "Down" : "Up";
    return [...new Array<string>(Math.abs(distance)).fill(moveKey), "Enter"];
  }

  private static nearestSelectedLine(lines: string[], aroundIndex: number): number | undefined {
    for (let distance = 0; distance <= greatestOptionDistance; distance += 1) {
      for (const index of [aroundIndex - distance, aroundIndex + distance]) {
        const line = lines[index]?.trimStart() ?? "";
        if (selectionMarkers.some((marker) => line.startsWith(marker))) return index;
      }
    }
    return undefined;
  }
}
