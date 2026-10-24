// What Callsign is waiting on above the command bar: a send about to go, a "which one?", a "say confirm",
// or the router thinking. Otherwise the last thing it heard.

import { useCallsign } from "../app-context.tsx";
import type { ControlState } from "../../shared/protocol.ts";

export function PendingStrip({ control }: { control: ControlState }) {
  const { perform } = useCallsign();

  if (control.preview) {
    const remaining = Math.max(0, control.preview.deadline - Date.now());
    return (
      <div key={control.preview.deadline} className="enter-rise relative overflow-hidden rounded-inner border border-line bg-raised px-3 py-2">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="shrink-0 font-mono text-ink-muted">to {control.preview.session}</span>
          <span className="min-w-0 flex-1 truncate text-ink">{control.preview.text}</span>
          <span className="shrink-0 text-[11px] text-ink-faint">say cancel to stop</span>
          <StripButton onClick={() => perform({ type: "send_now" })}>Send now</StripButton>
          <StripButton onClick={() => perform({ type: "cancel" })}>Cancel</StripButton>
        </div>
        <div className="countdown-bar absolute inset-x-0 bottom-0 h-0.5 bg-ink/70" style={{ "--countdown-duration": `${remaining}ms` } as React.CSSProperties} />
      </div>
    );
  }

  if (control.confirmation) {
    return (
      <div className="enter-rise flex items-center gap-2 rounded-inner border border-permission/60 bg-permission/10 px-3 py-2 text-[13px]">
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
      <div className="enter-rise flex flex-wrap items-center gap-2 rounded-inner border border-line bg-raised px-3 py-2 text-[13px]">
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
      <div className="flex items-center gap-2 px-1 text-[12px] text-ink-muted">
        <span className="spin size-3 rounded-full border border-ink-faint border-t-ink" />
        Working out where "{control.lastHeard}" goes
      </div>
    );
  }

  if (control.lastHeard) return <p className="truncate px-1 text-[12px] text-ink-faint">Heard: {control.lastHeard}</p>;
  return null;
}

function StripButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="press h-7 shrink-0 cursor-pointer rounded-inner border border-line bg-panel px-2.5 text-[12px] text-ink shadow-press hover:border-line-strong">
      {children}
    </button>
  );
}
