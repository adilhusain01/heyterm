// When a key press in a terminal copies its selection instead of reaching the agent. Pure.

export class TerminalCopy {
  static copiesSelection(event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, hasSelection: boolean, isMac: boolean): boolean {
    if (!hasSelection || event.key.toLowerCase() !== "c") return false;
    return isMac ? event.metaKey : event.ctrlKey;
  }
}
