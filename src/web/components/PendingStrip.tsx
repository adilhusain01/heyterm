// What HeyTerm is waiting on above the command bar: a send about to go, a "which one?", a "say confirm",
// or the assistant thinking. What you said shows in the conversation, so it is not repeated here.

import { useHeyTerm } from "../app-context.tsx";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { AssistantOrb } from "../ui/AssistantOrb.tsx";
import { Key } from "../ui/Key.tsx";
import type { ControlState } from "../../shared/protocol.ts";

export function PendingStrip({ control }: { control: ControlState }) {
  const { perform } = useHeyTerm();
  const latestReply = useHeyTermStore((state) => state.conversation.findLast((entry) => entry.kind === "assistant")?.text);

  if (control.preview) {
    const remaining = Math.max(0, control.preview.deadline - Date.now());
    return (
      <div key={control.preview.deadline} className="enter-rise relative overflow-hidden rounded-inner border border-line bg-raised px-3 py-2">
        <div className="flex items-baseline gap-2 text-meta">
          <span className="shrink-0 font-mono text-ink-muted">to {control.preview.session}</span>
          <span className="min-w-0 flex-1 truncate text-ink">{control.preview.text}</span>
          <span className="shrink-0 text-small text-ink-faint">say cancel to stop</span>
          <StripButton onClick={() => perform({ type: "send_now" })}>Send now</StripButton>
          <StripButton onClick={() => perform({ type: "cancel" })}>Cancel</StripButton>
        </div>
        <div className="countdown-bar absolute inset-x-0 bottom-0 h-0.5 bg-ink/70" style={{ "--countdown-duration": `${remaining}ms` } as React.CSSProperties} />
      </div>
    );
  }

  if (control.confirmation) {
    return (
      <div className="enter-rise flex items-center gap-2 rounded-inner border border-permission/60 bg-permission/10 px-3 py-2 text-meta">
        <span className="min-w-0 flex-1 text-ink">
          Say <span className="font-medium">confirm</span> to {control.confirmation}.
        </span>
        <StripButton onClick={() => perform({ type: "confirm" })}>Confirm</StripButton>
        <StripButton onClick={() => perform({ type: "cancel" })}>Cancel</StripButton>
      </div>
    );
  }

  if (control.clarify) {
    return (
      <div className="enter-rise flex flex-wrap items-center gap-2 rounded-inner border border-line bg-raised px-3 py-2 text-meta">
        <span className="text-ink">{control.clarify.question}</span>
        {control.clarify.options.map((option, index) => (
          <StripButton key={option} onClick={() => perform({ type: "choose", index })}>
            <span className="mr-1.5 font-mono text-ink-faint">{index + 1}</span>
            {option}
          </StripButton>
        ))}
      </div>
    );
  }

  if (control.routing) {
    return (
      <div className="flex items-center gap-2 px-1 text-small text-ink-muted lg:hidden">
        <AssistantOrb state="thinking" size={16} />
        Thinking
      </div>
    );
  }

  // Below the width where the conversation column shows, its latest reply sits here instead.
  return latestReply ? <p className="truncate px-1 text-small text-ink-muted lg:hidden">{latestReply}</p> : null;
}

function StripButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Key size="small" className="shrink-0" onClick={onClick}>
      {children}
    </Key>
  );
}
