// The conversation with the assistant: what you said, what it answered, what it did, and what
// happened in the sessions, newest at the bottom.

import { useEffect, useRef } from "react";
import { useCallsignStore } from "../state/callsign-store.ts";
import type { ConversationEntry } from "../../shared/protocol.ts";

export function ConversationPanel() {
  const entries = useCallsignStore((state) => state.conversation);
  const thinking = useCallsignStore((state) => state.control.routing);
  const listRef = useRef<HTMLOListElement>(null);

  // Follow new lines, unless the user scrolled up to read something older.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [entries, thinking]);

  return (
    <aside aria-label="Conversation with Callsign" className="hidden w-[380px] shrink-0 flex-col border-l border-line bg-panel lg:flex">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-[12px] font-medium text-ink">Callsign</span>
        {thinking && <ThinkingMark />}
      </header>
      {entries.length === 0 ? (
        <p className="p-3 text-[13px] leading-relaxed text-ink-muted">
          Talk to me about your sessions, or tell me what to do. Try "what is everyone doing?", "start a session in portfolio and fix the header", or "what changed in callsign today?"
        </p>
      ) : (
        <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <EntryRow entry={entry} />
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function EntryRow({ entry }: { entry: ConversationEntry }) {
  switch (entry.kind) {
    case "user":
      return (
        <p className="rounded-inner border border-line bg-raised px-2.5 py-1.5 text-[13px] leading-snug text-ink">
          <span className="mr-1.5 text-ink-faint">You</span>
          {entry.text}
        </p>
      );
    case "assistant":
      return <p className="whitespace-pre-wrap px-0.5 text-[13px] leading-relaxed text-ink">{entry.text}</p>;
    case "tool":
      return <p className="truncate px-0.5 font-mono text-[11px] text-ink-faint" title={entry.text}>› {entry.text}</p>;
    case "event":
      return <p className="truncate px-0.5 text-[12px] text-ink-muted" title={entry.text}>{entry.text}</p>;
    case "error":
      return <p className="px-0.5 text-[12px] text-failed">{entry.text}</p>;
  }
}

function ThinkingMark() {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span className="spin size-2.5 rounded-full border border-ink-faint border-t-ink" />
      Thinking
    </span>
  );
}
