// A short, sayable name for a session the user started outside HeyTerm.

import path from "node:path";

export interface ExternalSessionFacts {
  sessionTitle?: string;
  workingDirectory: string;
}

export class ExternalSessionNaming {
  static nameFor(facts: ExternalSessionFacts, takenNames: string[]): string {
    const base = slug(facts.sessionTitle ?? "") || slug(path.basename(facts.workingDirectory)) || "session";
    if (!takenNames.includes(base)) return base;
    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!takenNames.includes(candidate)) return candidate;
    }
  }
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
