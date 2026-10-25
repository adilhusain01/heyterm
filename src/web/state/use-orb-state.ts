// One answer to "what is the assistant doing", for every orb and status line on the page.

import { useHeyTermStore } from "./heyterm-store.ts";
import type { OrbState } from "../ui/AssistantOrb.tsx";

export function useOrbState(): OrbState {
  const thinking = useHeyTermStore((state) => state.control.routing);
  const speaking = useHeyTermStore((state) => state.speaking);
  const listening = useHeyTermStore((state) => state.listening);
  const barHasText = useHeyTermStore((state) => state.barHasText);
  const typingSession = useHeyTermStore((state) => state.typingSession);
  if (speaking) return "speaking";
  if (thinking) return "thinking";
  if (typingSession || (listening !== "listening" && listening !== "typing_in_terminal")) return "deaf";
  if (barHasText) return "hearing";
  return "idle";
}

export const orbStatusText: Record<OrbState, string> = {
  idle: "Listening",
  hearing: "Hearing you",
  thinking: "Thinking",
  speaking: "Speaking",
  deaf: "Not listening",
};
