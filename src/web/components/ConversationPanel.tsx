// The conversation with the assistant: what you said, what it answered, what it did, and what
// happened in the sessions, newest at the bottom. A session's request is a message here too: it can
// be answered where it arrived, and the answer follows it as your reply.

import { useEffect, useMemo, useRef, useState } from "react";
import { RequestThread } from "../../shared/request-thread.ts";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { orbStatusText, useOrbState } from "../state/use-orb-state.ts";
import { ArrowDownIcon, PanelRightCloseIcon } from "../ui/icons.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { RequestCard, SettledRequest } from "./AttentionCard.tsx";
import type { ConversationEntry } from "../../shared/protocol.ts";
import type { AttentionItem, SessionView } from "../../shared/types.ts";

// Within this distance of the end, the list counts as read to the bottom and follows new lines.
const followDistance = 120;

export function ConversationPanel() {
  const entries = useHeyTermStore((state) => state.conversation);
  const collapsed = useHeyTermStore((state) => state.layout.conversationCollapsed);
  const changeLayout = useHeyTermStore((state) => state.changeLayout);
  const orbState = useOrbState();
  const sessions = useHeyTermStore((state) => state.sessions);
  const listRef = useRef<HTMLOListElement>(null);
  const [isFollowing, setFollowing] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const currentStep = orbState === "thinking" ? latestStepSinceYouSpoke(entries) : undefined;
  const status = currentStep ?? orbStatusText[orbState];
  // A request older than the kept lines still needs an answer, so it goes at the end.
  const untold = useMemo(() => RequestThread.waitingWithoutEntry(entries, sessions), [entries, sessions]);

  // Follow new lines while the end is in view. Your own words and new requests always bring you there.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const latest = entries[entries.length - 1];
    if (isFollowing || latest?.kind === "user" || latest?.kind === "request") {
      list.scrollTop = list.scrollHeight;
      setHasUnread(false);
    } else setHasUnread(true);
  }, [entries, untold.length]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < followDistance;
    setFollowing(atEnd);
    if (atEnd) setHasUnread(false);
  };

  const jumpToLatest = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    setHasUnread(false);
  };

  if (collapsed) return null;
  const isEmpty = entries.length === 0 && untold.length === 0;
  return (
    <aside aria-label="Conversation with HeyTerm" className="hidden w-[380px] shrink-0 flex-col border-l border-line bg-panel lg:flex">
      {/* The orb lives in the bar you talk into, so the header only says what the assistant is doing. */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
        <div className="flex min-w-0 flex-col">
          <span className="text-meta font-medium text-ink">HeyTerm</span>
          <span key={status} className="status-swap truncate text-small text-ink-faint" aria-live="polite">
            {status}
          </span>
        </div>
        <button
          type="button"
          aria-label="Fold the conversation"
          title="Fold the conversation"
          onClick={() => changeLayout({ conversationCollapsed: true })}
          className="press ml-auto flex size-8 cursor-pointer items-center justify-center rounded-inner text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
        >
          <PanelRightCloseIcon size={16} />
        </button>
      </header>
      {isEmpty ? (
        <EmptyConversation />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <ol ref={listRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {entries.map((entry) => (
              <li key={entry.id} className="enter-rise">
                <EntryRow entry={entry} sessions={sessions} />
              </li>
            ))}
            {untold.map((item) => (
              <li key={`${item.sessionName}-${item.kind}-${item.since}`} className="enter-rise">
                <LiveRequest item={item} sessions={sessions} />
              </li>
            ))}
          </ol>
          {hasUnread && (
            <button
              type="button"
              onClick={jumpToLatest}
              className="press key-lift enter-rise absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-inner border border-line-strong bg-key px-3 text-meta text-ink shadow-key hover:bg-key-hover"
            >
              <ArrowDownIcon size={14} />
              New messages
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

function LiveRequest({ item, sessions }: { item: AttentionItem; sessions: SessionView[] }) {
  const session = sessions.find((candidate) => candidate.name === item.sessionName);
  return session ? <RequestCard item={item} session={session} variant="chat" /> : null;
}

function EntryRow({ entry, sessions }: { entry: ConversationEntry; sessions: SessionView[] }) {
  switch (entry.kind) {
    case "user":
      return (
        <div className="ml-auto w-fit max-w-[85%] rounded-outer bg-raised px-3 py-2 text-body break-words text-ink">
          {entry.text}
        </div>
      );
    case "request": {
      const request = entry.request;
      if (!request) return null;
      const live = RequestThread.waitingDecisions(sessions).find((item) => item.sessionName === request.session && item.kind === request.kind && item.since === request.since);
      return live ? <LiveRequest item={live} sessions={sessions} /> : <SettledRequest text={entry.text} sessionName={request.session} />;
    }
    case "assistant":
      return <Markdown text={entry.text} className="text-body text-ink" />;
    case "tool":
      return (
        <p className="flex items-baseline gap-2 font-mono text-small text-ink-faint" title={entry.text}>
          <span aria-hidden>›</span>
          <span className="truncate">{entry.text}</span>
        </p>
      );
    case "event":
      return (
        <p className="flex items-baseline gap-2 text-meta text-ink-muted" title={entry.text}>
          <span aria-hidden className="size-1.5 shrink-0 -translate-y-px rounded-mark bg-ink-faint" />
          <span className="line-clamp-2">{entry.text}</span>
        </p>
      );
    case "error":
      return <p className="rounded-inner border border-failed/30 bg-failed/10 px-3 py-2 text-meta text-failed">{entry.text}</p>;
  }
}

function EmptyConversation() {
  const examples = ["What is everyone doing?", "Start a session in portfolio and fix the header", "What changed in heyterm today?"];
  return (
    <div className="flex flex-col gap-3 px-4 py-5">
      <p className="text-body text-ink">Talk to me about your sessions, or tell me what to do. I run commands on this Mac too.</p>
      <ul className="flex flex-col gap-1.5">
        {examples.map((example) => (
          <li key={example} className="rounded-inner border border-line bg-tray px-3 py-2 text-meta text-ink-muted shadow-tray">
            "{example}"
          </li>
        ))}
      </ul>
    </div>
  );
}

// While the assistant works, the status line shows its latest step.
function latestStepSinceYouSpoke(entries: ConversationEntry[]): string | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (entry.kind === "user" || entry.kind === "assistant") return undefined;
    if (entry.kind === "tool") return stepLabel(entry.text);
  }
  return undefined;
}

function stepLabel(toolText: string): string {
  const shortened = toolText.length > 48 ? `${toolText.slice(0, 47)}…` : toolText;
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}
