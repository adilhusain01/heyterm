// An agent's mark, in the current text colour.

import { agents } from "./agents.ts";

export function AgentMark({ kind, size = 16, className = "" }: { kind: string; size?: number; className?: string }) {
  const agent = agents.find((candidate) => candidate.kind === kind);
  if (!agent) return null;
  return (
    <svg width={size} height={size} viewBox={agent.viewBox} fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
      {agent.paths.map((path) => (
        <path key={path.slice(0, 24)} d={path} />
      ))}
    </svg>
  );
}
