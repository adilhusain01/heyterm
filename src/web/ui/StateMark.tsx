// A session's state as one glyph, so a list can be read by shape as well as colour.

import type { SessionState } from "../../shared/types.ts";

const stateColor: Record<SessionState, string> = {
  starting: "text-idle",
  idle: "text-idle",
  working: "text-working",
  needs_permission: "text-permission",
  asked: "text-question",
  needs_trust: "text-trust",
  done: "text-finished",
  failed: "text-failed",
  stopped: "text-idle",
};

export function StateMark({ state, size = 12 }: { state: SessionState; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className={`shrink-0 ${stateColor[state]}`}>
      <StateShape state={state} />
    </svg>
  );
}

function StateShape({ state }: { state: SessionState }) {
  switch (state) {
    case "working":
      return (
        <>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
          <path d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="spin origin-center [transform-box:fill-box]" style={{ transformOrigin: "6px 6px" }} />
        </>
      );
    case "needs_permission":
    case "asked":
    case "needs_trust":
      return <rect x="2" y="2" width="8" height="8" rx="2" fill="currentColor" />;
    case "done":
      return <path d="M2.5 6.3 5 8.7l4.5-5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />;
    case "failed":
      return <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />;
    case "starting":
      return <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2.2" />;
    default:
      return <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />;
  }
}
