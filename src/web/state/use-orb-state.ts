// One answer to "what is the assistant doing", for every orb and status line on the page.

import { useCallsignStore } from "./callsign-store.ts";
import type { OrbState } from "../ui/AssistantOrb.tsx";

export function useOrbState(): OrbState {
  const thinking = useCallsignStore((state) => state.control.routing);
  const speaking = useCallsignStore((state) => state.speaking);
  const listening = useCallsignStore((state) => state.listening);
  const barHasText = useCallsignStore((state) => state.barHasText);
  const typingSession = useCallsignStore((state) => state.typingSession);
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
