// A session's face on the page, from the faces drawn at build time (scripts/site-faces.mjs).

import { AvatarTile } from "../../src/web/ui/AvatarTile.tsx";
import { faces } from "./faces.generated.ts";
import type { SessionState } from "../../src/shared/types.ts";

export function Face({ name, state, size = 28 }: { name: string; state?: SessionState; size?: number }) {
  return <AvatarTile name={name} face={faces[name] ?? ""} state={state} size={size} />;
}
