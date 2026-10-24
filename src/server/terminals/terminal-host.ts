// Callsign's own terminals: each session's program runs in a pseudo-terminal owned by Callsign,
// with a headless copy of its screen so the screen can be read and shown to a page that opens later.
// Works the same on macOS, Linux and Windows. When Callsign stops, every program stops with it.

import pty, { type IPty } from "@lydell/node-pty";
import serializeModule from "@xterm/addon-serialize";
import headlessModule from "@xterm/headless";
import { EventEmitter } from "node:events";
import { withoutInheritedMarkers } from "./environment.ts";
import { TerminalInput } from "./terminal-input.ts";

// Both packages are CommonJS; Node's ES module loader only gives their default export.
const { Terminal } = headlessModule;
const { SerializeAddon } = serializeModule;
type Terminal = InstanceType<typeof Terminal>;
type SerializeAddon = InstanceType<typeof SerializeAddon>;

const defaultColumns = 120;
const defaultRows = 36;
const scrollbackLines = 2_000;
// How long a program gets to redraw after a resize before a newly attached page is sent the screen.
const redrawSettleMilliseconds = 150;

export interface NewTerminalSession {
  name: string;
  workingDirectory: string;
  program: string;
  args: string[];
  environment: Record<string, string>;
}

// A page showing one terminal.
export interface TerminalViewer {
  send(data: string): void;
  close(): void;
}

export interface TerminalAttachment {
  write(data: string): void;
  resize(columns: number, rows: number): void;
  detach(): void;
}

interface HostedTerminal {
  process: IPty;
  screen: Terminal;
  serializer: SerializeAddon;
  viewers: Set<TerminalViewer>;
}

export class TerminalHost extends EventEmitter<{ exit: [string] }> {
  private readonly terminals = new Map<string, HostedTerminal>();

  listSessions(): Array<{ name: string }> {
    return [...this.terminals.keys()].map((name) => ({ name }));
  }

  hasSession(name: string): boolean {
    return this.terminals.has(name);
  }

  createSession(session: NewTerminalSession): void {
    if (this.terminals.has(session.name)) throw new Error(`A terminal called ${session.name} is already running.`);
    const environment: Record<string, string> = { ...withoutInheritedMarkers(process.env), TERM: "xterm-256color", ...session.environment };
    const child = pty.spawn(session.program, session.args, {
      name: "xterm-256color",
      cols: defaultColumns,
      rows: defaultRows,
      cwd: session.workingDirectory,
      env: environment,
    });
    const screen = new Terminal({ cols: defaultColumns, rows: defaultRows, scrollback: scrollbackLines, allowProposedApi: true });
    const serializer = new SerializeAddon();
    screen.loadAddon(serializer);
    const hosted: HostedTerminal = { process: child, screen, serializer, viewers: new Set() };
    this.terminals.set(session.name, hosted);

    child.onData((data) => {
      screen.write(data);
      for (const viewer of hosted.viewers) viewer.send(data);
    });
    child.onExit(() => {
      if (this.terminals.get(session.name) !== hosted) return;
      this.forget(session.name, hosted);
      this.emit("exit", session.name);
    });
  }

  killSession(name: string): void {
    const hosted = this.terminals.get(name);
    if (!hosted) return;
    this.forget(name, hosted);
    killQuietly(hosted.process);
  }

  // Text as one paste, so line breaks and symbols arrive as text, never as key presses.
  pasteText(name: string, text: string): void {
    const hosted = this.terminals.get(name);
    if (!hosted) return;
    hosted.process.write(TerminalInput.paste(text, { bracketedPaste: hosted.screen.modes.bracketedPasteMode }));
  }

  pressKeys(name: string, keys: string[]): void {
    this.terminals.get(name)?.process.write(TerminalInput.keys(keys));
  }

  // The visible screen as plain text. Async so callers wait for output still being parsed.
  captureScreen(name: string): Promise<string> {
    const hosted = this.terminals.get(name);
    if (!hosted) return Promise.resolve("");
    return new Promise((resolve) => {
      hosted.screen.write("", () => {
        const buffer = hosted.screen.buffer.active;
        const lines: string[] = [];
        for (let row = 0; row < hosted.screen.rows; row += 1) lines.push(buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? "");
        resolve(lines.join("\n"));
      });
    });
  }

  // A page joins: it gets the screen so far, then everything new. The latest page to resize sets the size.
  attach(name: string, viewer: TerminalViewer, columns: number, rows: number): TerminalAttachment | undefined {
    const hosted = this.terminals.get(name);
    if (!hosted) return undefined;
    this.resize(hosted, columns, rows);
    // The program redraws for the new size first; the copy sent is that redrawn screen. Output in
    // between lands in the copy, so nothing is missed or shown twice.
    let detached = false;
    setTimeout(() => {
      if (detached || this.terminals.get(name) !== hosted) return;
      viewer.send(hosted.serializer.serialize());
      hosted.viewers.add(viewer);
    }, redrawSettleMilliseconds);
    return {
      write: (data) => hosted.process.write(data),
      resize: (newColumns, newRows) => this.resize(hosted, newColumns, newRows),
      detach: () => {
        detached = true;
        hosted.viewers.delete(viewer);
      },
    };
  }

  shutdown(): void {
    for (const [name, hosted] of [...this.terminals]) {
      this.forget(name, hosted);
      killQuietly(hosted.process);
    }
  }

  private resize(hosted: HostedTerminal, columns: number, rows: number): void {
    const safeColumns = clampSize(columns, defaultColumns);
    const safeRows = clampSize(rows, defaultRows);
    if (safeColumns === hosted.screen.cols && safeRows === hosted.screen.rows) return;
    hosted.screen.resize(safeColumns, safeRows);
    try {
      hosted.process.resize(safeColumns, safeRows);
    } catch {
      // The program may have just ended.
    }
  }

  private forget(name: string, hosted: HostedTerminal): void {
    this.terminals.delete(name);
    for (const viewer of hosted.viewers) viewer.close();
    hosted.viewers.clear();
    hosted.screen.dispose();
  }
}

function killQuietly(child: IPty): void {
  try {
    child.kill();
  } catch {
    // Already gone.
  }
}

function clampSize(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 10 && value <= 500 ? Math.floor(value) : fallback;
}
