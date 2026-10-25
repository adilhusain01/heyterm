// Each session's own face: a pattern drawn from its name, in ink tones only, with its state as a
// small badge. The badge is the one place colour appears, so colour still means state alone.

import Avatar from "boring-avatars";
import type { SessionState } from "../../shared/types.ts";

const inkPalette = ["#eceef1", "#9aa3ae", "#5b636e", "#2a3038", "#161a1f"];

const badgeColor: Partial<Record<SessionState, string>> = {
  working: "bg-working",
  needs_permission: "bg-permission",
  asked: "bg-question",
  needs_trust: "bg-trust",
  done: "bg-finished",
  failed: "bg-failed",
};

export function SessionAvatar({ name, state, size = 28 }: { name: string; state?: SessionState; size?: number }) {
  const badge = state ? badgeColor[state] : undefined;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className="overflow-hidden rounded-[7px] ring-1 ring-line" style={{ width: size, height: size }}>
        <Avatar name={name} variant="bauhaus" colors={inkPalette} size={size} square />
      </span>
      {badge && <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-panel ${badge} ${state === "working" ? "animate-pulse" : ""}`} />}
    </span>
  );
}
