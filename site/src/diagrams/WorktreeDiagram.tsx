// Parallel sessions, drawn: the project's folder holds its first session and a plain terminal, and
// every further session in it gets a git worktree and a branch of its own. The key adds one, the way
// "start another session in api" does.

import { useState } from "react";
import { faces } from "../faces.generated.ts";
import { Connector, FaceImage } from "./kit.tsx";

const worktreeSessions = [{ name: "api-2" }, { name: "api-3" }];

const slotTop = 168;
const slotHeight = 96;
const slotGap = 16;
const trunkX = 40;

export function WorktreePiece() {
  const [added, setAdded] = useState(1);
  const full = added === worktreeSessions.length;
  const slots = worktreeSessions.map((session, index) => ({ ...session, y: slotTop + index * (slotHeight + slotGap) }));
  const lastShown = slots[added - 1]!;
  const ghost = slots[added];
  return (
    <div className="flex flex-col gap-4">
      <svg viewBox="0 0 320 392" role="img" aria-labelledby="worktree-title worktree-desc" className="mx-auto h-auto w-full max-w-[420px]">
        <title id="worktree-title">One folder, a worktree for each further session</title>
        <desc id="worktree-desc">The api folder on main holds the api session and a terminal; each further session gets its own worktree folder on a heyterm branch, so no two agents edit the same files.</desc>
        {/* The trunk ends at the newest worktree; earlier ones join it from the side. */}
        <Connector points={[[trunkX, 136], [trunkX, lastShown.y + slotHeight / 2], [72, lastShown.y + slotHeight / 2]]} lit />
        {slots.slice(0, added - 1).map((slot) => (
          <g key={slot.name}>
            <Connector points={[[trunkX, slot.y + slotHeight / 2], [72, slot.y + slotHeight / 2]]} lit />
            <circle cx={trunkX} cy={slot.y + slotHeight / 2} r={3} className="fill-accent" />
          </g>
        ))}
        {ghost && <Connector points={[[trunkX, lastShown.y + slotHeight / 2], [trunkX, ghost.y + slotHeight / 2], [72, ghost.y + slotHeight / 2]]} dashed />}

        <rect x={8} y={8} width={304} height={128} rx={12} className="fill-canvas stroke-line-strong" strokeWidth={1} />
        <text x={24} y={34} className="fill-ink font-mono" fontSize={12}>
          ~/Projects/api
        </text>
        <BranchTag x={296} y={22} text="main" anchor="end" />
        <SessionChip x={24} y={48} name="api" agent="Claude Code" face={faces.api ?? ""} />
        <SessionChip x={164} y={48} name="api-terminal" agent="Terminal" face={faces["api-terminal"] ?? ""} />

        {slots.slice(0, added).map((slot) => (
          <g key={slot.name} className="transition-[opacity,translate] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-1.5 starting:opacity-0 motion-reduce:starting:translate-y-0">
            <rect x={72} y={slot.y} width={240} height={slotHeight} rx={12} className="fill-key stroke-accent" strokeWidth={1.2} />
            <text x={88} y={slot.y + 24} className="fill-ink-muted font-mono" fontSize={12}>
              …/worktrees/api-{slot.name}
            </text>
            <FaceImage face={faces[slot.name] ?? ""} x={88} y={slot.y + 40} size={36} />
            <text x={136} y={slot.y + 56} className="fill-ink font-mono" fontSize={13}>
              {slot.name}
            </text>
            <text x={136} y={slot.y + 76} className="fill-accent-ink font-mono" fontSize={12}>
              heyterm/{slot.name}
            </text>
          </g>
        ))}
        {ghost && (
          <g>
            <rect x={72} y={ghost.y} width={240} height={slotHeight} rx={12} className="fill-none stroke-line-strong" strokeWidth={1} strokeDasharray="4 4" />
            <text x={192} y={ghost.y + slotHeight / 2 + 4} textAnchor="middle" className="fill-ink-faint font-sans" fontSize={12}>
              the next one goes here
            </text>
          </g>
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAdded(full ? 1 : added + 1)}
          className="press key-lift inline-flex h-9 cursor-pointer items-center rounded-inner border border-line-strong bg-key px-3.5 text-meta text-ink shadow-key hover:bg-key-hover"
        >
          {full ? "Start over" : "Start another session in api"}
        </button>
        <span className="text-small text-ink-faint">Terminals stay in the folder.</span>
      </div>
    </div>
  );
}

function SessionChip({ x, y, name, agent, face }: { x: number; y: number; name: string; agent: string; face: string }) {
  return (
    <g>
      <rect x={x} y={y} width={132} height={72} rx={8} className="fill-key stroke-line" strokeWidth={1} />
      <FaceImage face={face} x={x + 12} y={y + 10} size={28} />
      <text x={x + 48} y={y + 29} className="fill-ink-faint font-sans" fontSize={11}>
        {agent}
      </text>
      <text x={x + 12} y={y + 58} className="fill-ink font-mono" fontSize={12}>
        {name}
      </text>
    </g>
  );
}

function BranchTag({ x, y, text, anchor }: { x: number; y: number; text: string; anchor: "start" | "end" }) {
  const width = text.length * 7.2 + 16;
  const left = anchor === "end" ? x - width : x;
  return (
    <g>
      <rect x={left} y={y} width={width} height={18} rx={4} className="fill-none stroke-line-strong" strokeWidth={1} />
      <text x={left + width / 2} y={y + 13} textAnchor="middle" className="fill-ink-muted font-mono" fontSize={11}>
        {text}
      </text>
    </g>
  );
}
