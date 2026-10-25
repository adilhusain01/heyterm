// One session's live terminal. Click into it to type by hand; the command bar takes focus back after.

import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { useHeyTerm } from "../app-context.tsx";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { useServerNow } from "../state/use-server-now.ts";
import { CloseIcon, ExpandIcon, KeyboardIcon, ShrinkIcon } from "../ui/icons.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { RequestCard } from "./AttentionCard.tsx";
import { useSessionRequest } from "./DecisionDock.tsx";
import { isWaitingOnUser, shortDuration, stateDisplay } from "./session-display.ts";
import type { SessionView } from "../../shared/types.ts";

// Keystrokes this close together count as one keyboard action in the hands-off meter.
const keystrokeBurstMilliseconds = 2_000;

// Gruvbox Material dark in both page themes: agent CLIs pick their text colours for a dark terminal,
// so a light one would hide some of their text. The background matches --color-terminal.
const terminalTheme = {
  background: "#1d2021",
  foreground: "#d4be98",
  cursor: "#d4be98",
  cursorAccent: "#1d2021",
  selectionBackground: "#45403d",
  black: "#32302f",
  red: "#ea6962",
  green: "#a9b665",
  yellow: "#d8a657",
  blue: "#7daea3",
  magenta: "#d3869b",
  cyan: "#89b482",
  white: "#d4be98",
  brightBlack: "#928374",
  brightRed: "#ea6962",
  brightGreen: "#a9b665",
  brightYellow: "#d8a657",
  brightBlue: "#7daea3",
  brightMagenta: "#d3869b",
  brightCyan: "#89b482",
  brightWhite: "#ddc7a1",
};

interface TerminalPaneProps {
  session: SessionView;
  isExpanded: boolean;
  // Absent when there is nothing to switch between, such as a single session.
  onToggleExpanded?: () => void;
}

export function TerminalPane({ session, isExpanded, onToggleExpanded }: TerminalPaneProps) {
  const { connection, perform } = useHeyTerm();
  const isFocused = useHeyTermStore((state) => state.focusedSession === session.name);
  const isTyping = useHeyTermStore((state) => state.typingSession === session.name);
  const setTypingSession = useHeyTermStore((state) => state.setTypingSession);
  const recordAction = useHeyTermStore((state) => state.recordAction);
  const now = useServerNow();
  const containerRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const terminalRef = useRef<Terminal | undefined>(undefined);
  const display = stateDisplay[session.state];
  const request = useSessionRequest(session.name);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const terminal = new Terminal({ fontFamily: '"Geist Mono Variable", ui-monospace, monospace', fontSize: 12, lineHeight: 1.2, theme: terminalTheme, cursorBlink: false, allowProposedApi: true });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    loadWebglRenderer(terminal);
    fit.fit();
    terminalRef.current = terminal;
    const channel = connection.openTerminal(session.name, terminal.cols, terminal.rows);
    channel.onData((data) => terminal.write(data));
    channel.onClose(() => terminal.write("\r\n\x1b[2mDisconnected from this session.\x1b[0m\r\n"));
    // onData also carries the terminal's automatic replies to tmux; only onKey is a person typing.
    const input = terminal.onData((data) => channel.write(data));
    let lastKeystrokeAt = 0;
    const keys = terminal.onKey(() => {
      const now = Date.now();
      if (now - lastKeystrokeAt > keystrokeBurstMilliseconds) recordAction("keyboard");
      lastKeystrokeAt = now;
    });
    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      channel.resize(terminal.cols, terminal.rows);
    });
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      input.dispose();
      keys.dispose();
      channel.close();
      terminal.dispose();
      terminalRef.current = undefined;
    };
  }, [connection, session.name, recordAction]);

  useEffect(() => {
    if (isTyping) terminalRef.current?.focus();
    else terminalRef.current?.blur();
  }, [isTyping]);

  useEffect(() => {
    if (isFocused) paneRef.current?.scrollIntoView({ block: "nearest" });
  }, [isFocused]);

  const borderClass = isTyping ? "border-ink/60" : isFocused ? "border-line-strong" : "border-line";

  return (
    <section ref={paneRef} className={`flex h-full min-h-[280px] w-full min-w-0 flex-col overflow-hidden rounded-outer border bg-terminal transition-colors duration-200 ${borderClass}`}>
      <header className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line bg-panel px-3">
        <SessionAvatar name={session.name} state={session.state} size={22} />
        <span className="truncate font-mono text-meta text-ink">{session.name}</span>
        <span className={`text-small ${display.textClass}`}>{display.label}</span>
        {isWaitingOnUser(session.state) && <span className="font-mono text-small text-ink-muted tabular-nums">{shortDuration(now - session.stateSince)}</span>}
        <div className="ml-auto flex items-center gap-0.5">
          {isTyping && (
            <span className="mr-1 flex items-center gap-1 text-small text-ink-muted">
              <KeyboardIcon size={13} /> Typing here
            </span>
          )}
          {onToggleExpanded && (
            <PaneButton label={isExpanded ? "Show all sessions" : "Show only this session"} onClick={onToggleExpanded}>
              {isExpanded ? <ShrinkIcon size={14} /> : <ExpandIcon size={14} />}
            </PaneButton>
          )}
          <PaneButton label={`Close ${session.name}`} onClick={() => perform({ type: "close", session: session.name, confirmed: false })}>
            <CloseIcon size={14} />
          </PaneButton>
        </div>
      </header>
      {request && <RequestCard item={request.item} session={request.session} variant="banner" />}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 cursor-text"
        onMouseDown={() => {
          setTypingSession(session.name);
          perform({ type: "focus", session: session.name });
        }}
      />
    </section>
  );
}

export function PaneButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="press flex size-7 cursor-pointer items-center justify-center rounded-small text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink">
      {children}
    </button>
  );
}

// The GPU renderer is faster; when the browser refuses it, xterm's default renderer is used.
function loadWebglRenderer(terminal: Terminal): void {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    terminal.loadAddon(webgl);
  } catch {
    // Keep the default renderer.
  }
}
