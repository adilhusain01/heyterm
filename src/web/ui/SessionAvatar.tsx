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
        className="rounded-[7px] select-none"
        style={{ background: `oklch(0.78 0.07 ${hue})`, boxShadow: `inset 0 0 0 1px oklch(0.62 0.07 ${hue})` }}
      />
      {badge && <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-panel ${badge} ${state === "working" ? "animate-pulse" : ""}`} />}
    </span>
  );
}
