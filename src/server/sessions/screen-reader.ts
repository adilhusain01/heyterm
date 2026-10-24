// Reads a Claude Code screen for the one dialog no hook reports: trusting a new folder.

const trustOptionText = /Yes, I trust this folder/;
const selectionMarker = "❯";
// The dialog's options sit together; a marker further away belongs to something else.
const greatestOptionDistance = 4;

export class ScreenReader {
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
        if (lines[index]?.trimStart().startsWith(selectionMarker)) return index;
      }
    }
    return undefined;
  }
}
