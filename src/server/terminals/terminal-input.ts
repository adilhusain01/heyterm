// The bytes a terminal program receives for named keys and for pasted text.

const keySequences: Record<string, string> = {
  Enter: "\r",
  "C-m": "\r",
  Escape: "\x1b",
  Tab: "\t",
  "C-c": "\x03",
  "C-d": "\x04",
  BSpace: "\x7f",
  Up: "\x1b[A",
  Down: "\x1b[B",
  Right: "\x1b[C",
  Left: "\x1b[D",
  // Grok Build's dialogs answer to a letter.
  y: "y",
};

const pasteStart = "\x1b[200~";
const pasteEnd = "\x1b[201~";

export class TerminalInput {
  static keys(names: string[]): string {
    return names
      .map((name) => {
        const sequence = keySequences[name];
        if (sequence === undefined) throw new Error(`Unknown key: ${name}`);
        return sequence;
      })
      .join("");
  }

  // Dictated text as the program would get it from a real paste. Control characters are dropped,
  // so text can never press keys; without bracketed paste, line breaks become spaces.
  static paste(text: string, { bracketedPaste }: { bracketedPaste: boolean }): string {
    const withoutMarkers = text.replaceAll(pasteStart, "").replaceAll(pasteEnd, "");
    const lines = withoutMarkers.split(/\r\n|\r|\n/).map((line) => line.replace(/[\x00-\x1f\x7f]/g, ""));
    if (!bracketedPaste) return lines.join(" ");
    return `${pasteStart}${lines.join("\r")}${pasteEnd}`;
  }
}
