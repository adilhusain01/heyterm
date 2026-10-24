// A session running in the user's own terminal: no live screen here, but its state, its whole last
// message and anything it waits on.

import { useServerNow } from "../state/use-server-now.ts";
import { isWaitingOnUser, shortDuration, stateDisplay } from "./session-display.ts";
import type { SessionView } from "../../shared/types.ts";

export function ExternalSessionPane({ session }: { session: SessionView }) {
  const now = useServerNow();
  const display = stateDisplay[session.state];
  return (
    <section className={`flex min-h-[200px] min-w-0 flex-col overflow-hidden rounded-outer border border-line bg-canvas ${display.ringClass}`}>
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
        <span className={`size-2 rounded-mark ${display.markClass}`} />
        <span className="truncate font-mono text-[12px] text-ink">{session.name}</span>
        <span className={`text-[11px] ${display.textClass}`}>{display.label}</span>
        {isWaitingOnUser(session.state) && <span className="font-mono text-[11px] text-ink-muted tabular-nums">{shortDuration(now - session.stateSince)}</span>}
        <span className="ml-auto text-[11px] text-ink-faint">in your own terminal</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-[13px]">
        <p className="truncate font-mono text-[12px] text-ink-faint">{session.projectPath}</p>
        {session.lastPrompt && <p className="text-ink-muted">Last task: {session.lastPrompt}</p>}
        {session.lastMessage && <p className="whitespace-pre-wrap leading-relaxed text-ink">{session.lastMessage}</p>}
      </div>
    </section>
  );
}
