// What needs a decision, right above the bar you talk into: the most urgent request in full, and the
// others as faces to switch to.

import { useMemo, useState } from "react";
import { AttentionQueue } from "../../shared/attention.ts";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { decisionKinds, RequestCard } from "./AttentionCard.tsx";

export function DecisionDock() {
  const sessions = useHeyTermStore((state) => state.sessions);
  const requests = useMemo(() => AttentionQueue.build(sessions).filter((item) => decisionKinds.includes(item.kind)), [sessions]);
  const [chosenName, setChosenName] = useState<string | undefined>(undefined);
  const shown = requests.find((item) => item.sessionName === chosenName) ?? requests[0];
  const shownSession = shown ? sessions.find((session) => session.name === shown.sessionName) : undefined;
  if (!shown || !shownSession) return null;
  const others = requests.filter((item) => item !== shown);
  return (
    <div className="flex flex-col gap-1.5">
      <RequestCard item={shown} session={shownSession} variant="dock" />
      {others.length > 0 && (
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[12.5px] text-ink-faint">{others.length} more waiting</span>
          {others.map((item) => (
            <button
              key={`${item.sessionName}-${item.kind}`}
              type="button"
              title={item.headline}
              aria-label={`Show ${item.sessionName}'s request`}
              onClick={() => setChosenName(item.sessionName)}
              className="press cursor-pointer rounded-[8px] p-0.5 transition-colors duration-150 hover:bg-raised"
            >
              <SessionAvatar name={item.sessionName} state={sessions.find((session) => session.name === item.sessionName)?.state} size={22} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The request a session is waiting on, if it needs a decision, for the banner on its own pane.
export function useSessionRequest(sessionName: string) {
  const session = useHeyTermStore((state) => state.sessions.find((candidate) => candidate.name === sessionName));
  return useMemo(() => {
    if (!session) return undefined;
    const item = AttentionQueue.build([session])[0];
    return item && decisionKinds.includes(item.kind) ? { item, session } : undefined;
  }, [session]);
}
