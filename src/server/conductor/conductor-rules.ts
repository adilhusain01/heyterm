// Small decisions around the assistant: what it is asked at all, what of its reply is said out
// loud, and which of its own commands wait for a spoken "confirm".

import { PermissionRisk } from "../safety/permission-risk.ts";
import type { RouterAction } from "../../shared/types.ts";

// These need words a model would add nothing to, or explain things in its own words when asked.
const actionsForTheAssistant: RouterAction["type"][] = ["catch_up", "status"];

export class ConductorRouting {
  static handledInstantly(action: RouterAction, { confirmationWaiting }: { confirmationWaiting: boolean }): boolean {
    // A confirm with nothing waiting in Callsign answers something the assistant asked.
    if (action.type === "confirm" && !confirmationWaiting) return false;
    return !actionsForTheAssistant.includes(action.type);
  }
}

export class SpokenReply {
  // The assistant writes what it says first; anything after a line of "---" is only shown.
  static from(reply: string): { spoken: string; shown: string } {
    const [spokenPart = "", ...shownParts] = reply.split(/\n\s*---\s*\n/);
    const shown = [spokenPart.trim(), ...shownParts.map((part) => part.trim())].filter(Boolean).join("\n\n");
    return { spoken: speakable(spokenPart), shown };
  }
}

export class ConductorSafety {
  static commandDecision(command: string): { needsConfirm: false } | { needsConfirm: true; reason: string } {
    const assessment = PermissionRisk.assess({ toolName: "Bash", toolInput: { command }, projectPath: "" });
    if (assessment.risk !== "high") return { needsConfirm: false };
    return { needsConfirm: true, reason: assessment.riskReasons[0] ?? "is risky" };
  }
}

function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_#>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
