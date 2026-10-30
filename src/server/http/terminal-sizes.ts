// One terminal can show in several panes (two tabs, a phone), each its own size, but a program has
// one size and draws for it. A pane at another size shows its drawing broken: on 30 October 2026 a
// tab with heyterm alone at 218 columns sized the terminal, and the pane being used, 106 wide, got
// every line cut in two. So the terminal takes the size of the pane used last, as tmux's "latest"
// window size does: typed into, resized, opened in a tab in front, or the pane left when the one
// that set the size closes. A tab in the background that opens a pane gets no say.

export interface PaneSize {
  columns: number;
  rows: number;
}

interface SizedTerminal {
  // Most recently used last.
  panes: PaneSize[];
  applied: PaneSize;
}

export class TerminalSizes {
  private readonly terminals = new Map<string, SizedTerminal>();

  // Opening a pane has already given the terminal the pane's size (TerminalHost.attach). Returns
  // the size to give it instead, when the pane is in a tab in the background.
  opened(sessionName: string, pane: PaneSize, { isInUse }: { isInUse: boolean }): PaneSize | undefined {
    const terminal = this.terminals.get(sessionName);
    if (!terminal) {
      this.terminals.set(sessionName, { panes: [pane], applied: { ...pane } });
      return undefined;
    }
    terminal.applied = { ...pane };
    if (isInUse) {
      terminal.panes.push(pane);
      return undefined;
    }
    terminal.panes.unshift(pane);
    return this.apply(terminal, terminal.panes.at(-1)!);
  }

  // The pane was typed into or resized. Returns the size to give the terminal, if it differs.
  used(sessionName: string, pane: PaneSize): PaneSize | undefined {
    const terminal = this.terminals.get(sessionName);
    if (!terminal) return undefined;
    terminal.panes = [...terminal.panes.filter((other) => other !== pane), pane];
    return this.apply(terminal, pane);
  }

  // Returns the size of the pane used last among those left, if it differs.
  closed(sessionName: string, pane: PaneSize): PaneSize | undefined {
    const terminal = this.terminals.get(sessionName);
    if (!terminal) return undefined;
    terminal.panes = terminal.panes.filter((other) => other !== pane);
    const latest = terminal.panes.at(-1);
    if (!latest) {
      this.terminals.delete(sessionName);
      return undefined;
    }
    return this.apply(terminal, latest);
  }

  private apply(terminal: SizedTerminal, pane: PaneSize): PaneSize | undefined {
    if (terminal.applied.columns === pane.columns && terminal.applied.rows === pane.rows) return undefined;
    terminal.applied = { ...pane };
    return terminal.applied;
  }
}
