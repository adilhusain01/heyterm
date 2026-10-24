// A session running in the user's own terminal: no live screen here, but its state, its whole last
// message and anything it waits on.

import { useServerNow } from "../state/use-server-now.ts";
import { StateMark } from "../ui/StateMark.tsx";
import { isWaitingOnUser, shortDuration, stateDisplay } from "./session-display.ts";
import type { SessionView } from "../../shared/types.ts";

export function ExternalSessionPane({ session }: { session: SessionView }) {
  const now = useServerNow();
  const display = stateDisplay[session.state];
  return (
    <section className={`flex min-h-[200px] min-w-0 flex-col overflow-hidden rounded-outer border border-line bg-tray ${display.ringClass}`}>
      <header className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line bg-panel px-3">
        <StateMark state={session.state} />
        <span className="truncate font-mono text-meta text-ink">{session.name}</span>
        <span className={`text-[12.5px] ${display.textClass}`}>{display.label}</span>
        {isWaitingOnUser(session.state) && <span className="font-mono text-[12.5px] text-ink-muted tabular-nums">{shortDuration(now - session.stateSince)}</span>}
        <span className="ml-auto text-[12.5px] text-ink-faint">in your own terminal</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <p className="truncate font-mono text-[12.5px] text-ink-faint">{session.projectPath}</p>
        {session.lastPrompt && <p className="line-clamp-3 text-meta text-ink-muted">Last task: {session.lastPrompt}</p>}
        {session.lastMessage && <p className="whitespace-pre-wrap break-words text-body text-ink">{session.lastMessage}</p>}
      </div>
    </section>
  );
}
