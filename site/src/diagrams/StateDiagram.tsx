// A session's states, drawn from the transitions HeyTerm's hooks report (session-lifecycle.ts). Every
// state below "Working" waits on you, and your answer or next task takes the session back to work.
// Picking a state shows its face badge, what you hear, and what you can say.

import { useState } from "react";
import { Face } from "../Face.tsx";
import { ArrowMarkers, Connector, ConnectorLabel } from "./kit.tsx";
import type { SessionState } from "../../../src/shared/types.ts";

interface StateBox {
  state: SessionState;
  label: string;
  x: number;
  y: number;
  width: number;
  face: string;
  heard: string;
  say: string;
}

const boxHeight = 40;

// Text colours by state, the app's own: each colour means one state and nothing else.
const stateText: Partial<Record<SessionState, string>> = {
  working: "fill-working",
  needs_permission: "fill-permission",
  asked: "fill-question",
  needs_trust: "fill-trust",
  done: "fill-finished",
  failed: "fill-failed",
};
const stateStroke: Partial<Record<SessionState, string>> = {
  working: "stroke-working",
  needs_permission: "stroke-permission",
  asked: "stroke-question",
  needs_trust: "stroke-trust",
  done: "stroke-finished",
  failed: "stroke-failed",
};

const boxes: StateBox[] = [
  { state: "starting", label: "Starting", x: 16, y: 16, width: 136, face: "shop", heard: "Nothing yet. The agent is opening in its own terminal.", say: "Wait a moment, or start another." },
  { state: "needs_trust", label: "Needs trust", x: 168, y: 16, width: 136, face: "shop", heard: "shop wants you to trust its folder.", say: "trust it" },
  { state: "idle", label: "Idle", x: 16, y: 96, width: 136, face: "docs", heard: "Nothing. It is ready for a task.", say: "docs, update the install guide" },
  { state: "working", label: "Working", x: 16, y: 176, width: 136, face: "api", heard: "Nothing while it works, unless it goes quiet for five minutes.", say: "what is api doing?" },
  { state: "needs_permission", label: "Needs a permission", x: 24, y: 288, width: 132, face: "mobile", heard: "mobile wants to install a package, and it says how risky that is.", say: "approve, or no and why" },
  { state: "asked", label: "Asked you", x: 164, y: 288, width: 132, face: "shop", heard: "shop asks which database to use: Neon or Supabase.", say: "Neon, or the second one" },
  { state: "done", label: "Done", x: 24, y: 336, width: 132, face: "tests", heard: "tests finished: all 48 pass.", say: "catch me up, or give it the next task" },
  { state: "failed", label: "Failed", x: 164, y: 336, width: 132, face: "web", heard: "web failed, with the reason it gave.", say: "go to web" },
];

export function StatePiece() {
  const [chosen, setChosen] = useState<SessionState>("needs_permission");
  const box = boxes.find((candidate) => candidate.state === chosen)!;
  const byState = (state: SessionState) => boxes.find((candidate) => candidate.state === state)!;
  const starting = byState("starting");
  const trust = byState("needs_trust");
  const idle = byState("idle");
  const working = byState("working");
  return (
    <div className="flex flex-col gap-5">
      <svg viewBox="0 0 320 392" role="group" aria-labelledby="states-title" className="mx-auto h-auto w-full max-w-[420px]">
        <title id="states-title">A session's states. Pick one to see what you hear and what to say.</title>
        <ArrowMarkers prefix="states" />
        <Connector points={[[starting.x + starting.width, 36], [trust.x - 2, 36]]} arrow="states" />
        <Connector points={[[trust.x + trust.width / 2, 56], [trust.x + trust.width / 2, 116], [idle.x + idle.width + 2, 116]]} arrow="states" />
        <Connector points={[[84, 56], [84, 94]]} arrow="states" />
        <Connector points={[[84, 136], [84, 174]]} arrow="states" />
        <ConnectorLabel x={96} y={160} text="you give it a task" anchor="start" width={124} />
        <Connector points={[[84, 216], [84, 254]]} lit arrow="states" />
        <ConnectorLabel x={96} y={244} text="it stops" anchor="start" width={56} />
        {/* Every waiting state goes back to work the same way: through you. */}
        <Connector points={[[264, 256], [264, 196], [154, 196]]} lit dashed arrow="states" />
        <ConnectorLabel x={196} y={184} text="your answer" anchor="start" width={80} />
        <rect x={8} y={256} width={304} height={128} rx={12} className="fill-none stroke-accent/50" strokeWidth={1} strokeDasharray="4 4" />
        <text x={24} y={276} className="fill-accent-ink font-sans" fontSize={11}>
          waits on you
        </text>
        {boxes.map((candidate) => {
          const selected = candidate.state === chosen;
          const center = candidate.x + candidate.width / 2;
          return (
            <g
              key={candidate.state}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={candidate.label}
              onClick={() => setChosen(candidate.state)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setChosen(candidate.state);
              }}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-accent [&:focus-visible>rect]:[stroke-width:2]"
            >
              <rect
                x={candidate.x}
                y={candidate.y}
                width={candidate.width}
                height={boxHeight}
                rx={8}
                className={`transition-[fill,stroke] duration-150 ${selected ? "fill-key" : "fill-canvas hover:fill-key"} ${stateStroke[candidate.state] ?? "stroke-line-strong"}`}
                strokeWidth={selected ? 2 : 1}
              />
              <text x={center} y={candidate.y + 25} textAnchor="middle" className={`${stateText[candidate.state] ?? "fill-ink-muted"} pointer-events-none font-sans`} fontSize={12} fontWeight={selected ? 600 : 500}>
                {candidate.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div key={chosen} className="status-swap flex items-start gap-4 rounded-inner border border-line bg-canvas p-4" aria-live="polite">
        <Face name={box.face} state={box.state} size={44} />
        <div className="flex min-w-0 flex-col gap-1.5 text-body">
          <p className="text-ink">
            <span className="text-ink-faint">You hear: </span>
            {box.heard}
          </p>
          <p className="text-ink">
            <span className="text-ink-faint">You say: </span>"{box.say}"
          </p>
        </div>
      </div>
    </div>
  );
}
