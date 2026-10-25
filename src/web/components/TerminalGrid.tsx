// Every live session, in a grid that grows with the window or one at a time with tabs to switch.
// Panes keep a usable size however many sessions run: past two rows the grid scrolls.

import { useEffect, useRef, useState } from "react";
import { useHeyTerm } from "../app-context.tsx";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { FocusIcon, GridIcon, PanelRightOpenIcon } from "../ui/icons.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { ExternalSessionPane } from "./ExternalSessionPane.tsx";
import { stateDisplay } from "./session-display.ts";
import { TerminalPane } from "./TerminalPane.tsx";
import type { SessionView } from "../../shared/types.ts";

// A pane narrower than this cannot show a terminal comfortably.
const narrowestPaneWidth = 440;
// Past two rows, each row keeps this height and the grid scrolls.
const scrollingRowHeight = 420;
const gap = 8;

export function TerminalGrid() {
  const sessions = useHeyTermStore((state) => state.sessions);
  const arrangement = useHeyTermStore((state) => state.layout.arrangement);
  const focusedSession = useHeyTermStore((state) => state.focusedSession);
  const focused = sessions.find((session) => session.name === focusedSession) ?? sessions[0];
  const showFocus = arrangement === "focus" && focused !== undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GridToolbar sessions={sessions} focused={showFocus ? focused : undefined} />
      {showFocus ? (
        <div className="flex min-h-0 flex-1 p-2 pt-0">
          <SessionPane session={focused} />
        </div>
      ) : (
        <AutoGrid sessions={sessions} />
      )}
    </div>
  );
}

function AutoGrid({ sessions }: { sessions: SessionView[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => entry && setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const columns = Math.max(1, Math.min(sessions.length, Math.floor((size.width + gap) / (narrowestPaneWidth + gap))));
  const rows = Math.ceil(sessions.length / columns);
  const rowHeight = rows <= 2 ? Math.max(300, (size.height - gap * (rows - 1)) / rows) : scrollingRowHeight;
  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${rowHeight}px`, gap }}>
        {sessions.map((session) => (
          <SessionPane key={session.name} session={session} />
        ))}
      </div>
    </div>
  );
}

function SessionPane({ session }: { session: SessionView }) {
  const arrangement = useHeyTermStore((state) => state.layout.arrangement);
  const changeLayout = useHeyTermStore((state) => state.changeLayout);
  const { perform } = useHeyTerm();
  if (session.origin === "external") return <ExternalSessionPane session={session} />;
  return (
    <TerminalPane
      session={session}
      isExpanded={arrangement === "focus"}
      onToggleExpanded={() => {
        if (arrangement === "focus") return changeLayout({ arrangement: "grid" });
        perform({ type: "focus", session: session.name });
        changeLayout({ arrangement: "focus" });
      }}
    />
  );
}

function GridToolbar({ sessions, focused }: { sessions: SessionView[]; focused: SessionView | undefined }) {
  const { perform } = useHeyTerm();
  const arrangement = useHeyTermStore((state) => state.layout.arrangement);
  const conversationCollapsed = useHeyTermStore((state) => state.layout.conversationCollapsed);
  const changeLayout = useHeyTermStore((state) => state.changeLayout);
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 px-2">
      <div role="radiogroup" aria-label="Arrangement" className="flex rounded-inner border border-line bg-tray p-0.5 shadow-tray">
        <ArrangementButton label="Grid" selected={arrangement === "grid"} onClick={() => changeLayout({ arrangement: "grid" })}>
          <GridIcon size={14} />
        </ArrangementButton>
        <ArrangementButton label="One at a time" selected={arrangement === "focus"} onClick={() => changeLayout({ arrangement: "focus" })}>
          <FocusIcon size={14} />
        </ArrangementButton>
      </div>
      {focused ? (
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {sessions.map((session) => (
            <button
              key={session.name}
              type="button"
              onClick={() => perform({ type: "focus", session: session.name })}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-inner px-2 py-1 text-small transition-colors duration-150 ${session.name === focused.name ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"}`}
            >
              <SessionAvatar name={session.name} state={session.state} size={18} />
              <span className="font-mono">{session.name}</span>
              <span className={stateDisplay[session.state].textClass}>{stateDisplay[session.state].label}</span>
            </button>
          ))}
        </div>
      ) : (
        <span className="flex-1 text-small text-ink-faint">
          {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
        </span>
      )}
      {conversationCollapsed && (
        <button
          type="button"
          aria-label="Show the conversation"
          title="Show the conversation"
          onClick={() => changeLayout({ conversationCollapsed: false })}
          className="press hidden size-8 cursor-pointer items-center justify-center rounded-inner text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink lg:flex"
        >
          <PanelRightOpenIcon size={16} />
        </button>
      )}
    </div>
  );
}

function ArrangementButton({ label, selected, onClick, children }: { label: string; selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex size-7 cursor-pointer items-center justify-center rounded-small transition-colors duration-150 ${selected ? "bg-key text-ink shadow-key" : "text-ink-faint hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
