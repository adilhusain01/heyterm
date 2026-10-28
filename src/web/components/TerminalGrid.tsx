// Every live session, in a grid that grows with the window, or one at a time after a pane's expand key.
// Panes keep a usable size however many sessions run: past two rows the grid scrolls. There is no
// toolbar: expand and shrink live on each pane, and the sidebar picks which session is shown.

import { useEffect, useRef, useState } from "react";
import { useHeyTerm } from "../app-context.tsx";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { ExternalSessionPane } from "./ExternalSessionPane.tsx";
import { GridPanes } from "./grid-panes.ts";
import { TerminalPane } from "./TerminalPane.tsx";
import type { SessionView } from "../../shared/types.ts";

// A pane narrower than this cannot show a terminal comfortably.
const narrowestPaneWidth = 440;
// Past two rows, each row keeps this height and the grid scrolls.
const scrollingRowHeight = 420;
const gap = 8;

export function TerminalGrid() {
  const allSessions = useHeyTermStore((state) => state.sessions);
  const arrangement = useHeyTermStore((state) => state.layout.arrangement);
  const focusedSession = useHeyTermStore((state) => state.focusedSession);
  const sessions = GridPanes.shown(allSessions, focusedSession);
  const leftOutCount = allSessions.length - sessions.length;
  const focused = sessions.find((session) => session.name === focusedSession) ?? sessions[0];
  // One session is already shown on its own, so there is nothing to expand.
  const showFocus = arrangement === "focus" && focused !== undefined && sessions.length > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showFocus ? (
        <div className="flex min-h-0 flex-1 p-2">
          <SessionPane session={focused} isExpanded canExpand />
        </div>
      ) : sessions.length === 0 ? (
        <p className="m-auto px-6 text-center text-meta text-ink-faint">
          {leftOutCount === 1 ? "A session in your own terminal is" : `${leftOutCount} sessions in your own terminal are`} in the sidebar. They show here when they need you, or when you pick one.
        </p>
      ) : (
        <AutoGrid sessions={sessions} canExpand={sessions.length > 1} />
      )}
    </div>
  );
}

function AutoGrid({ sessions, canExpand }: { sessions: SessionView[]; canExpand: boolean }) {
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
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto p-2">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${rowHeight}px`, gap }}>
        {sessions.map((session) => (
          <SessionPane key={session.name} session={session} isExpanded={false} canExpand={canExpand} />
        ))}
      </div>
    </div>
  );
}

function SessionPane({ session, isExpanded, canExpand }: { session: SessionView; isExpanded: boolean; canExpand: boolean }) {
  const changeLayout = useHeyTermStore((state) => state.changeLayout);
  const { perform } = useHeyTerm();
  const toggleExpanded = () => {
    if (isExpanded) return changeLayout({ arrangement: "grid" });
    perform({ type: "focus", session: session.name });
    changeLayout({ arrangement: "focus" });
  };
  const onToggleExpanded = canExpand ? toggleExpanded : undefined;
  if (session.origin === "external") return <ExternalSessionPane session={session} isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} />;
  return <TerminalPane session={session} isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} />;
}
