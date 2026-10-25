// While the conversation is folded away, what needs a decision sits in one slim row above the bar you
// talk into: the most urgent request, and the others as faces to switch to.

import { useMemo, useState } from "react";
import { AttentionQueue } from "../../shared/attention.ts";
import { RequestThread } from "../../shared/request-thread.ts";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { RailLabel } from "../ui/RailLabel.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { RequestCard } from "./AttentionCard.tsx";

export function DecisionDock() {
  const sessions = useHeyTermStore((state) => state.sessions);
  const requests = useMemo(() => RequestThread.waitingDecisions(sessions), [sessions]);
  const [chosenName, setChosenName] = useState<string | undefined>(undefined);
  const shown = requests.find((item) => item.sessionName === chosenName) ?? requests[0];
  const shownSession = shown ? sessions.find((session) => session.name === shown.sessionName) : undefined;
  if (!shown || !shownSession) return null;
  const others = requests.filter((item) => item !== shown);
  return (
    <div className="enter-rise flex items-center rounded-outer border border-line-strong bg-panel">
      <div className="min-w-0 flex-1">
        <RequestCard key={`${shown.sessionName}-${shown.since}`} item={shown} session={shownSession} variant="bar" />
      </div>
      {others.length > 0 && (
        <div className="flex shrink-0 items-center gap-0.5 self-stretch border-l border-line px-1.5">
          {others.map((item) => (
            <RailLabel key={`${item.sessionName}-${item.kind}`} label={item.headline}>
              <button
                type="button"
                aria-label={`Show ${item.sessionName}'s request`}
                onClick={() => setChosenName(item.sessionName)}
                className="press flex size-8 cursor-pointer items-center justify-center rounded-inner transition-colors duration-150 hover:bg-raised"
              >
                <SessionAvatar name={item.sessionName} state={sessions.find((session) => session.name === item.sessionName)?.state} size={22} />
              </button>
            </RailLabel>
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
    return item && RequestThread.isDecision(item.kind) ? { item, session } : undefined;
  }, [session]);
}
