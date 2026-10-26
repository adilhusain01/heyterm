// What the parts that act on sessions need for a session on another computer: whether a name is one,
// and a way to have that computer's HeyTerm do the action and say how it went (remote-hosts.ts).

import type { Feedback } from "../../shared/protocol.ts";
import type { RouterAction } from "../../shared/types.ts";

export interface RemoteSessionGateway {
  isRemote(sessionName: string): boolean;
  perform(action: RouterAction): Promise<Feedback>;
  readScreen(sessionName: string): Promise<string>;
}
