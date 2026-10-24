// Tells Wispr's dictation from typing. Wispr pastes a whole phrase in one input event; a keyboard adds a character at a time.

export type InputSource = "voice" | "keyboard";

export class DictationDetector {
  static readonly quietMillisecondsBeforeSubmit = 600;
  // A keyboard adds one character per input event; two or more at once came from dictation (or a paste).
  static readonly smallestDictatedBurst = 2;

  inputSource: InputSource | undefined;
  private lastDictationAt: number | undefined;
  private editedByHand = false;

  recordChange(previousText: string, nextText: string, at: number): void {
    const addedText = nextText.length > previousText.length ? insertedText(previousText, nextText) : "";
    if (isDictatedBurst(addedText)) {
      this.inputSource = this.editedByHand ? "keyboard" : "voice";
      this.lastDictationAt = at;
      return;
    }
    // Any small change by hand means the user is editing; do not send under their fingers.
    this.editedByHand = true;
    this.inputSource = "keyboard";
  }

  shouldSubmit(now: number): boolean {
    if (this.inputSource !== "voice" || this.lastDictationAt === undefined) return false;
    return now - this.lastDictationAt >= DictationDetector.quietMillisecondsBeforeSubmit;
  }

  reset(): void {
    this.inputSource = undefined;
    this.lastDictationAt = undefined;
    this.editedByHand = false;
  }
}

function insertedText(previousText: string, nextText: string): string {
  let prefixLength = 0;
  while (prefixLength < previousText.length && previousText[prefixLength] === nextText[prefixLength]) prefixLength += 1;
  return nextText.slice(prefixLength, prefixLength + (nextText.length - previousText.length));
}

function isDictatedBurst(addedText: string): boolean {
  return addedText.length >= DictationDetector.smallestDictatedBurst;
}
