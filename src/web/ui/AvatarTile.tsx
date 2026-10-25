// The tile a session's face sits on: a soft colour drawn from the name, the face, and the state as a
// badge. It takes the face already drawn, so a page that knows its faces ahead (the landing page)
// needs no face generator at all. SessionAvatar draws faces with DiceBear and uses this.

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

// The corner grows with the face, so an 18px face and a 32px one have the same shape.
export function avatarRadius(size: number): number {
  return Math.round(size * 0.24);
}

export function AvatarTile({ name, face, state, size = 28 }: { name: string; face: string; state?: SessionState; size?: number }) {
  const hue = SessionIdentity.hue(name);
  const badge = state ? badgeColor[state] : undefined;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <img
        src={face}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="select-none"
        style={{ borderRadius: avatarRadius(size), background: `oklch(0.8 0.065 ${hue})`, outline: "1px solid var(--color-image-outline)", outlineOffset: -1 }}
      />
      {badge && <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-panel ${badge} ${state === "working" ? "animate-pulse" : ""}`} />}
    </span>
  );
}
