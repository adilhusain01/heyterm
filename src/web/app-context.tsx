// The backend and the announcer, and the three ways the UI acts: words, clicks and focus.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useHeyTermStore } from "./state/heyterm-store.ts";
import type { Announcer } from "./voice/announcer.ts";
import type { HeyTermConnection } from "./transport/connection.ts";
import type { InputSource } from "../shared/protocol.ts";
import type { RouterAction } from "../shared/types.ts";

interface HeyTermActions {
  connection: HeyTermConnection;
  announcer: Announcer;
  sendUtterance: (text: string, source: InputSource) => void;
  // A button press: counted as pointer use, and sent to the server as a ready-made action.
  perform: (action: RouterAction) => void;
  focusSession: (sessionName: string) => void;
}

const HeyTermContext = createContext<HeyTermActions | undefined>(undefined);

export function HeyTermProvider({ connection, announcer, children }: { connection: HeyTermConnection; announcer: Announcer; children: ReactNode }) {
  const recordAction = useHeyTermStore((state) => state.recordAction);
  const actions = useMemo<HeyTermActions>(
    () => ({
      connection,
      announcer,
      sendUtterance: (text, source) => {
        recordAction(source);
        connection.send({ type: "utterance", text, source });
      },
      perform: (action) => {
        recordAction("pointer");
        announcer.unlock();
        connection.send({ type: "action", action });
      },
      focusSession: (sessionName) => connection.send({ type: "focus", session: sessionName }),
    }),
    [connection, announcer, recordAction],
  );
  return <HeyTermContext.Provider value={actions}>{children}</HeyTermContext.Provider>;
}

export function useHeyTerm(): HeyTermActions {
  const actions = useContext(HeyTermContext);
  if (!actions) throw new Error("useHeyTerm needs a HeyTermProvider above it");
  return actions;
}
