// The conversation with the assistant: what you said, what it answered, what it did, and what
// happened in the sessions, newest at the bottom. A session's request is a message here too: it can
// be answered where it arrived, and the answer follows it as your reply.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ConversationFollow } from "./conversation-follow.ts";
import { RequestThread } from "../../shared/request-thread.ts";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { orbStatusText, useOrbState } from "../state/use-orb-state.ts";
import { ArrowDownIcon, PanelRightCloseIcon } from "../ui/icons.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { RequestCard, SettledRequest } from "./AttentionCard.tsx";
import type { ConversationEntry } from "../../shared/protocol.ts";
import type { AttentionItem, SessionView } from "../../shared/types.ts";


export function ConversationPanel() {
  const entries = useHeyTermStore((state) => state.conversation);
  const collapsed = useHeyTermStore((state) => state.layout.conversationCollapsed);
  const changeLayout = useHeyTermStore((state) => state.changeLayout);
  const orbState = useOrbState();
  const sessions = useHeyTermStore((state) => state.sessions);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLOListElement>(null);
  // A ref, so the size observer below always reads the current value.
  const isFollowingRef = useRef(true);
  const shownRequestKeysRef = useRef<string[]>([]);
  const lastEntryIdRef = useRef<number | undefined>(undefined);
  const [hasUnread, setHasUnread] = useState(false);
  const currentStep = orbState === "thinking" ? latestStepSinceYouSpoke(entries) : undefined;
  const status = currentStep ?? orbStatusText[orbState];
  // A request older than the kept lines still needs an answer, so it goes at the end.
  const untold = useMemo(() => RequestThread.waitingWithoutEntry(entries, sessions), [entries, sessions]);

  const isEmpty = entries.length === 0 && untold.length === 0;

  // While the end is in view, follow whatever changes the list's size: a new message, a request card
  // filling in once its session's state arrives, a card opening up.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const observer = new ResizeObserver(() => {
      if (isFollowingRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [isEmpty, collapsed]);

  // Your own words bring you to the end; a new permission or question is always brought into view.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const requestKeys = [...scroller.querySelectorAll<HTMLElement>("[data-request-key]")].map((element) => element.dataset.requestKey!);
    const newRequestKeys = ConversationFollow.newRequests(shownRequestKeysRef.current, requestKeys);
    shownRequestKeysRef.current = requestKeys;
    // Only words just said count: the column re-renders often, and an old message of yours at the end
    // must not keep pulling the view down while you read further up.
    const latest = entries.at(-1);
    const isNewMessage = latest !== undefined && latest.id !== lastEntryIdRef.current;
    const youJustSpoke = isNewMessage && latest.kind === "user";
    lastEntryIdRef.current = latest?.id;
    if (youJustSpoke || isFollowingRef.current) {
      scroller.scrollTop = scroller.scrollHeight;
      isFollowingRef.current = true;
      setHasUnread(false);
      return;
    }
    // Reading further up: say something new arrived, by message rather than by height, since the
    // column keeps 80 lines and a new one at the end drops the oldest from the top.
    if (isNewMessage) setHasUnread(true);
    const newest = newRequestKeys.at(-1);
    const card = newest ? scroller.querySelector<HTMLElement>(`[data-request-key="${CSS.escape(newest)}"]`) : null;
    if (card) bringIntoView(scroller, card);
  }, [entries, untold, sessions]);

  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const atEnd = ConversationFollow.isAtEnd(scroller);
    isFollowingRef.current = atEnd;
    if (atEnd) setHasUnread(false);
  };

  const jumpToLatest = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    isFollowingRef.current = true;
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    setHasUnread(false);
  };

  if (collapsed) return null;
  return (
    <aside aria-label="Conversation with HeyTerm" className="my-2 mr-2 hidden w-[380px] shrink-0 flex-col overflow-hidden rounded-outer border border-line bg-panel lg:flex">
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
          <div ref={scrollerRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
          <ol ref={contentRef} className="flex flex-col gap-3 px-4 py-4">
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
          </div>
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

// Scrolls only the column (scrollIntoView would also move the panel around it) so the whole card shows,
// its top first when it is taller than the column.
function bringIntoView(scroller: HTMLElement, element: HTMLElement): void {
  const scrollerBox = scroller.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  const margin = 16;
  if (box.bottom > scrollerBox.bottom) scroller.scrollTop += Math.min(box.bottom - scrollerBox.bottom + margin, box.top - scrollerBox.top - margin);
  else if (box.top < scrollerBox.top) scroller.scrollTop -= scrollerBox.top - box.top + margin;
}

// A command or tool the assistant used. The line opens to show it in full with its output, and
// closes again; no animation, since it is opened often. The output can be selected and copied.
function ToolLine({ entry }: { entry: ConversationEntry }) {
  const [isOpen, setOpen] = useState(false);
  const output = entry.output;
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className="-mx-1.5 flex cursor-pointer items-baseline gap-2 rounded-small px-1.5 py-0.5 text-left font-mono text-small text-ink-faint transition-colors duration-150 hover:bg-raised hover:text-ink-muted"
      >
        <span aria-hidden className={`inline-block shrink-0 ${isOpen ? "rotate-90" : ""}`}>›</span>
        <span className={isOpen ? "break-all text-ink" : "truncate"}>{entry.text}</span>
        {output?.failed && <span className="ml-auto shrink-0 font-sans text-failed">Failed</span>}
      </button>
      {isOpen && (
        <pre className={`max-h-72 overflow-auto rounded-inner border bg-tray px-2.5 py-2 font-mono text-small break-words whitespace-pre-wrap text-ink shadow-tray ${output?.failed ? "border-failed/50" : "border-line"}`}>
          {output ? output.text || "No output." : "Running…"}
        </pre>
      )}
    </div>
  );
}

function LiveRequest({ item, sessions }: { item: AttentionItem; sessions: SessionView[] }) {
  const session = sessions.find((candidate) => candidate.name === item.sessionName);
  // The key lets the column bring a request into view once, when it first appears.
  return session ? (
    <div data-request-key={`${item.sessionName}-${item.kind}-${item.since}`}>
      <RequestCard item={item} session={session} variant="chat" />
    </div>
  ) : null;
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
      return <ToolLine entry={entry} />;
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
