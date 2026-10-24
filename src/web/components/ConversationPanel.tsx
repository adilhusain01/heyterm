// The conversation with the assistant: what you said, what it answered, what it did, and what
// happened in the sessions, newest at the bottom.

import { useEffect, useRef } from "react";
import { useCallsignStore } from "../state/callsign-store.ts";
import { orbStatusText, useOrbState } from "../state/use-orb-state.ts";
import { AssistantOrb } from "../ui/AssistantOrb.tsx";
import type { ConversationEntry } from "../../shared/protocol.ts";

export function ConversationPanel() {
  const entries = useCallsignStore((state) => state.conversation);
  const orbState = useOrbState();
  const listRef = useRef<HTMLOListElement>(null);
  const currentStep = orbState === "thinking" ? latestStepSinceYouSpoke(entries) : undefined;
  const status = currentStep ?? orbStatusText[orbState];

  // Follow new lines, unless the user scrolled up to read something older.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 160;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [entries]);

  return (
    <aside aria-label="Conversation with Callsign" className="hidden w-[400px] shrink-0 flex-col border-l border-line bg-panel lg:flex">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <AssistantOrb state={orbState} size={28} />
        <div className="flex min-w-0 flex-col">
          <span className="text-meta font-medium text-ink">Callsign</span>
          <span key={status} className="status-swap truncate text-[12.5px] text-ink-faint" aria-live="polite">
            {status}
          </span>
        </div>
      </header>
      {entries.length === 0 ? (
        <EmptyConversation />
      ) : (
        <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {entries.map((entry) => (
            <li key={entry.id} className="enter-rise">
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
      return <div className="ml-8 rounded-inner border border-line bg-tray px-3 py-2 text-body text-ink shadow-tray">{entry.text}</div>;
    case "assistant":
      return <p className="whitespace-pre-wrap break-words text-body text-ink">{entry.text}</p>;
    case "tool":
      return (
        <p className="flex items-baseline gap-2 font-mono text-[12.5px] text-ink-faint" title={entry.text}>
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
  const examples = ["What is everyone doing?", "Start a session in portfolio and fix the header", "What changed in callsign today?"];
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
