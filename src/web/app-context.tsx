// The backend and the announcer, and the three ways the UI acts: words, clicks and focus.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useCallsignStore } from "./state/callsign-store.ts";
import type { Announcer } from "./voice/announcer.ts";
import type { CallsignConnection } from "./transport/connection.ts";
import type { InputSource } from "../shared/protocol.ts";
import type { RouterAction } from "../shared/types.ts";

interface CallsignActions {
  connection: CallsignConnection;
  announcer: Announcer;
  sendUtterance: (text: string, source: InputSource) => void;
  // A button press: counted as pointer use, and sent to the server as a ready-made action.
  perform: (action: RouterAction) => void;
  focusSession: (sessionName: string) => void;
}

const CallsignContext = createContext<CallsignActions | undefined>(undefined);

export function CallsignProvider({ connection, announcer, children }: { connection: CallsignConnection; announcer: Announcer; children: ReactNode }) {
  const recordAction = useCallsignStore((state) => state.recordAction);
  const actions = useMemo<CallsignActions>(
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
  return <CallsignContext.Provider value={actions}>{children}</CallsignContext.Provider>;
}

export function useCallsign(): CallsignActions {
  const actions = useContext(CallsignContext);
  if (!actions) throw new Error("useCallsign needs a CallsignProvider above it");
  return actions;
}
