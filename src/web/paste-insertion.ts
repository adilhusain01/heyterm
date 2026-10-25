// What the bar holds after a paste, worked out by Callsign instead of the browser. Wispr pastes with
// Cmd+V; on 25 October 2026 the browser started those pastes but never inserted the text (something
// in the page's browser cancelled it), so the bar inserts the pasted text itself.

export class PasteInsertion {
  static apply(current: string, selection: { start: number; end: number }, pasted: string): { text: string; caret: number } {
    const oneLine = pasted.replace(/\s*[\r\n]+\s*/g, " ");
    const before = current.slice(0, selection.start);
    const after = current.slice(selection.end);
    const needsSpace = before.length > 0 && !/\s$/.test(before) && after.length === 0;
    const inserted = `${needsSpace ? " " : ""}${oneLine}`;
    return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
  }
}
