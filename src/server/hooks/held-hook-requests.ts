// Permission and question hooks that Callsign keeps open until the user decides.

import { permissionHookTimeoutSeconds } from "./hook-installer.ts";

export type PermissionDecision =
  | { behavior: "allow"; updatedInput?: Record<string, unknown> }
  | { behavior: "deny"; message: string };

interface HeldRequest {
  sessionName: string;
  respond: (body: string) => void;
  timer: NodeJS.Timeout;
}

// Let go a little before the hook script gives up, so Claude Code always gets a clean answer.
const holdMilliseconds = (permissionHookTimeoutSeconds - 10) * 1_000;

export class HeldHookRequests {
  private readonly held = new Map<string, HeldRequest>();

  hold(requestId: string, sessionName: string): Promise<string> {
    return new Promise((resolve) => {
      // Letting go with an empty answer leaves the decision to the terminal dialog.
      const timer = setTimeout(() => this.letGo(requestId), holdMilliseconds);
      this.held.set(requestId, { sessionName, respond: resolve, timer });
    });
  }

  isHeld(requestId: string): boolean {
    return this.held.has(requestId);
  }

  decide(requestId: string, decision: PermissionDecision): boolean {
    const request = this.held.get(requestId);
    if (!request) return false;
    this.finish(requestId, request, JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision } }));
    return true;
  }

  letGo(requestId: string): void {
    const request = this.held.get(requestId);
    if (request) this.finish(requestId, request, "");
  }

  // The session moved on (answered by hand, turn ended): its old requests mean nothing now.
  letGoAllFor(sessionName: string, exceptRequestId?: string): void {
    for (const [requestId, request] of this.held) {
      if (request.sessionName === sessionName && requestId !== exceptRequestId) this.finish(requestId, request, "");
    }
  }

  private finish(requestId: string, request: HeldRequest, body: string): void {
    clearTimeout(request.timer);
    this.held.delete(requestId);
    request.respond(body);
  }
}
