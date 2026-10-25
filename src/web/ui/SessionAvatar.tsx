// Each session's own face: its initials on a soft colour of its own, with its state as a small badge.
// The tile colours stay muted, so the saturated state colours on the badges still stand out.

import { SessionIdentity } from "../components/session-identity.ts";
import type { SessionState } from "../../shared/types.ts";

const badgeColor: Partial<Record<SessionState, string>> = {
  working: "bg-working",
  needs_permission: "bg-permission",
  asked: "bg-question",
  needs_trust: "bg-trust",
  done: "bg-finished",
  failed: "bg-failed",
};

export function SessionAvatar({ name, state, size = 28 }: { name: string; state?: SessionState; size?: number }) {
  const hue = SessionIdentity.hue(name);
  const initials = SessionIdentity.initials(name);
  const badge = state ? badgeColor[state] : undefined;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="flex items-center justify-center rounded-[7px] font-semibold tracking-tight select-none"
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * (initials.length > 1 ? 0.36 : 0.44)),
          background: `oklch(0.33 0.055 ${hue})`,
          color: `oklch(0.92 0.06 ${hue})`,
          boxShadow: `inset 0 0 0 1px oklch(0.42 0.06 ${hue})`,
        }}
      >
        {initials}
      </span>
      {badge && <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-panel ${badge} ${state === "working" ? "animate-pulse" : ""}`} />}
    </span>
  );
}
