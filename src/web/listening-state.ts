// Whether dictation would reach the command bar right now. Wispr types into whatever has the cursor,
// so when that is not the bar the user has to be told, or their words vanish without a trace.

export type FocusedElement = "bar" | "terminal" | "other_field" | "nothing";
export type Listening = "listening" | "window_in_background" | "typing_in_terminal" | "not_listening";

export class ListeningState {
  static of({ windowHasFocus, focusedElement }: { windowHasFocus: boolean; focusedElement: FocusedElement }): Listening {
    if (!windowHasFocus) return "window_in_background";
    // With no field focused, dictation arrives as a paste on the page and the bar takes it.
    if (focusedElement === "bar" || focusedElement === "nothing") return "listening";
    if (focusedElement === "terminal") return "typing_in_terminal";
    return "not_listening";
  }

  // A paste into the bar, or with no field under the cursor, is dictation: the bar inserts it itself.
  static pasteBelongsToBar(focusedElement: FocusedElement): boolean {
    return focusedElement === "bar" || focusedElement === "nothing";
  }

  static focusedElement(active: Element | null, bar: HTMLInputElement | null): FocusedElement {
    if (active && active === bar) return "bar";
    if (active?.closest(".xterm")) return "terminal";
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)) return "other_field";
    return "nothing";
  }
}
