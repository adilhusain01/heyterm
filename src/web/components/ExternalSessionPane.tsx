// A session running in the user's own terminal: no live screen here, but its state, its whole last
// message and anything it waits on.

import { useHeyTerm } from "../app-context.tsx";
import { useServerNow } from "../state/use-server-now.ts";
import { Key } from "../ui/Key.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { SessionIdentity } from "./session-identity.ts";
import { PaneButton } from "./TerminalPane.tsx";
import { ExpandIcon, ShrinkIcon } from "../ui/icons.tsx";
import { isWaitingOnUser, shortDuration, stateDisplay } from "./session-display.ts";
import type { SessionView } from "../../shared/types.ts";

export function ExternalSessionPane({ session, isExpanded, onToggleExpanded }: { session: SessionView; isExpanded: boolean; onToggleExpanded?: () => void }) {
  const { perform } = useHeyTerm();
  const now = useServerNow();
  const display = stateDisplay[session.state];
  return (
    <section className="flex h-full min-h-[200px] w-full min-w-0 flex-col overflow-hidden rounded-outer border border-line bg-tray">
      <header className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line bg-panel px-3">
        <SessionAvatar name={session.name} state={session.state} size={22} />
        <span className="truncate font-mono text-meta text-ink">{session.name}</span>
        <span className={`text-small ${display.textClass}`}>{display.label}</span>
        {isWaitingOnUser(session.state) && <span className="font-mono text-small text-ink-muted tabular-nums">{shortDuration(now - session.stateSince)}</span>}
        <span className="ml-auto text-small text-ink-faint">in your own terminal</span>
        {/* Closes it in that terminal and reopens the same conversation here, with a live screen. */}
        <Key size="small" className="shrink-0" onClick={() => perform({ type: "adopt", session: session.name, confirmed: false })}>
          Open here
        </Key>
        {onToggleExpanded && (
          <PaneButton label={isExpanded ? "Show all sessions" : "Show only this session"} onClick={onToggleExpanded}>
            {isExpanded ? <ShrinkIcon size={14} /> : <ExpandIcon size={14} />}
          </PaneButton>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <p className="truncate font-mono text-small text-ink-faint">{session.projectPath}</p>
        {SessionIdentity.promptPreview(session.lastPrompt ?? "") && <p className="line-clamp-3 text-meta text-ink-muted">Last task: {SessionIdentity.promptPreview(session.lastPrompt ?? "")}</p>}
        {session.lastMessage && <Markdown text={session.lastMessage} className="text-body text-ink" />}
      </div>
    </section>
  );
}
