// All live sessions side by side, or one of them on its own.

import { useState } from "react";
import { useCallsignStore } from "../state/callsign-store.ts";
import { ExternalSessionPane } from "./ExternalSessionPane.tsx";
import { TerminalPane } from "./TerminalPane.tsx";

// Columns for a number of panes on a wide screen; a phone always gets one column.
function gridColumnsClass(count: number): string {
  if (count <= 1) return "md:grid-cols-1";
  if (count <= 4) return "md:grid-cols-2";
  return "md:grid-cols-3";
}

export function TerminalGrid() {
  const sessions = useCallsignStore((state) => state.sessions);
  const [expandedSession, setExpandedSession] = useState<string | undefined>(undefined);
  const visible = expandedSession ? sessions.filter((session) => session.name === expandedSession) : sessions;
  const rows = Math.ceil(visible.length / (visible.length <= 1 ? 1 : visible.length <= 4 ? 2 : 3));

  return (
    <div
      className={`grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 ${gridColumnsClass(visible.length)}`}
      style={{ gridAutoRows: rows <= 2 ? `minmax(280px, calc((100% - ${(rows - 1) * 8}px) / ${rows}))` : "minmax(280px, 1fr)" }}
    >
      {visible.map((session) =>
        session.origin === "external" ? (
          <ExternalSessionPane key={session.name} session={session} />
        ) : (
        <TerminalPane
          key={session.name}
          session={session}
          isExpanded={expandedSession === session.name}
          onToggleExpanded={() => setExpandedSession(expandedSession === session.name ? undefined : session.name)}
        />
        ),
      )}
    </div>
  );
}
