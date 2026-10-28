// Which sessions get a pane in the grid. A session in the user's own terminal has no screen here, so it
// gets one only while it needs them or once they pick it in the sidebar; it stays in the sidebar always.

import { isWaitingOnUser } from "./session-display.ts";
import type { SessionView } from "../../shared/types.ts";

export class GridPanes {
  static shown(sessions: SessionView[], focusedSession: string | undefined): SessionView[] {
    return sessions.filter((session) => GridPanes.hasPane(session, focusedSession));
  }

  static leftOut(sessions: SessionView[], focusedSession: string | undefined): SessionView[] {
    return sessions.filter((session) => !GridPanes.hasPane(session, focusedSession));
  }

  private static hasPane(session: SessionView, focusedSession: string | undefined): boolean {
    return session.origin !== "external" || isWaitingOnUser(session.state) || session.name === focusedSession;
  }
}
