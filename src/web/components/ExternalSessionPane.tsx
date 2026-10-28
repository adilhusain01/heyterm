// A session running in the user's own terminal: no live screen here, but its state, its whole last
// message and anything it waits on.

import { toast } from "sonner";
import { useHeyTerm } from "../app-context.tsx";
import { firstImage } from "../transport/attach-image.ts";
import { useServerNow } from "../state/use-server-now.ts";
import { Key } from "../ui/Key.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { SessionIdentity } from "./session-identity.ts";
import { PaneButton } from "./TerminalPane.tsx";
import { ExpandIcon, ShrinkIcon } from "../ui/icons.tsx";
import { displayFor, isWaitingOnUser, shortDuration } from "./session-display.ts";
import type { SessionView } from "../../shared/types.ts";

export function ExternalSessionPane({ session, isExpanded, onToggleExpanded }: { session: SessionView; isExpanded: boolean; onToggleExpanded?: () => void }) {
  const { perform } = useHeyTerm();
  const now = useServerNow();
  const display = displayFor(session);
  const whereItRuns = `in your own terminal${session.host ? ` on ${session.host}` : ""}`;
  return (
    <section
      // HeyTerm cannot type into a session in the user's own terminal, so a dropped image is answered with how to move it here.
      onDragOver={(event) => {
        if ([...event.dataTransfer.items].some((item) => item.kind === "file")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!firstImage(event.dataTransfer.files)) return;
        event.preventDefault();
        toast.warning(`${session.name} runs in your own terminal, so HeyTerm cannot attach to it. Press Open here first.`);
      }}
      className="flex h-full min-h-[200px] w-full min-w-0 flex-col overflow-hidden rounded-outer border border-line bg-tray"
    >
      <header className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line bg-panel px-3">
        <SessionAvatar name={session.name} state={session.state} size={22} />
        <span className="truncate font-mono text-meta text-ink">{session.name}</span>
        <span className={`shrink-0 whitespace-nowrap text-small ${display.textClass}`}>{display.label}</span>
        {isWaitingOnUser(session.state) && <span className="shrink-0 font-mono text-small text-ink-muted tabular-nums">{shortDuration(now - session.stateSince)}</span>}
        {/* The least needed words here, sized by the room the name leaves: whole, then the sidebar's
            short "own terminal", then nothing, never a stub like "in your …". */}
        <span title={whereItRuns} className="@container ml-auto flex min-w-0 flex-1 justify-end text-small text-ink-faint">
          {/* Widths measured at this text size: 117px alone, 157px with "on vps", 75px for the short form. */}
          <span className={`hidden truncate ${session.host ? "@min-[10rem]:block" : "@min-[7.5rem]:block"}`}>{whereItRuns}</span>
          <span className={`hidden whitespace-nowrap @min-[5rem]:block ${session.host ? "@min-[10rem]:hidden" : "@min-[7.5rem]:hidden"}`}>own terminal</span>
        </span>
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
