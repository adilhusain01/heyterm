// Each session's own face: a DiceBear Adventurer drawn from its name, on the tile AvatarTile draws.
// The style is CC BY 4.0 by Lisa Wischofsky; the SVG carries that credit in its metadata, and
// THIRD_PARTY_NOTICES.md names it too.

import { Avatar, Style } from "@dicebear/core";
import adventurer from "@dicebear/styles/adventurer.json" with { type: "json" };
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { AvatarTile } from "./AvatarTile.tsx";
import type { SessionState } from "../../shared/types.ts";

export { avatarRadius } from "./AvatarTile.tsx";

const adventurerStyle = new Style(adventurer);
// Drawing a face takes a few milliseconds, and the same names render on every update.
const facesByName = new Map<string, string>();

export function faceFor(name: string): string {
  let face = facesByName.get(name);
  if (!face) {
    face = new Avatar(adventurerStyle, { seed: name }).toDataUri();
    facesByName.set(name, face);
  }
  return face;
}

// A renamed session keeps the face of its first name, wherever only its current name is known.
export function SessionAvatar({ name, state, size = 28 }: { name: string; state?: SessionState; size?: number }) {
  const faceSeed = useHeyTermStore((store) => store.sessions.find((session) => session.name === name)?.faceSeed ?? store.recentlyClosed.find((closed) => closed.name === name)?.faceSeed);
  return <AvatarTile name={name} face={faceFor(faceSeed ?? name)} state={state} size={size} />;
}
