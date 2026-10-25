// When the command bar takes focus back. It keeps dictation landing in the bar, but never at the
// cost of a selection the user is making or about to copy. Pure.

export class FocusReclaim {
  static shouldReclaim({ anotherFieldHasFocus, pointerIsDown, hasSelectedText }: { anotherFieldHasFocus: boolean; pointerIsDown: boolean; hasSelectedText: boolean }): boolean {
    return !anotherFieldHasFocus && !pointerIsDown && !hasSelectedText;
  }
}
