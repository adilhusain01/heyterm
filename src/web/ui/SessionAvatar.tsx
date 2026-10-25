// Each session's own face: a DiceBear Adventurer drawn from its name on a soft colour of its own, with
// its state as a small badge. The style is CC BY 4.0 by Lisa Wischofsky; the SVG carries that credit in
// its metadata, and THIRD_PARTY_NOTICES.md names it too.

import { Avatar, Style } from "@dicebear/core";
import adventurer from "@dicebear/styles/adventurer.json" with { type: "json" };
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

const adventurerStyle = new Style(adventurer);
// Drawing a face takes a few milliseconds, and the same names render on every update.
const facesByName = new Map<string, string>();

function faceFor(name: string): string {
  let face = facesByName.get(name);
  if (!face) {
    face = new Avatar(adventurerStyle, { seed: name }).toDataUri();
    facesByName.set(name, face);
  }
  return face;
}

// The corner grows with the face, so an 18px face and a 32px one have the same shape.
export function avatarRadius(size: number): number {
  return Math.round(size * 0.24);
}

export function SessionAvatar({ name, state, size = 28 }: { name: string; state?: SessionState; size?: number }) {
  const hue = SessionIdentity.hue(name);
  const badge = state ? badgeColor[state] : undefined;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <img
        src={faceFor(name)}
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
