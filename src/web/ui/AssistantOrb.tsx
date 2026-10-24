// The assistant's face: a round matrix of dots that shows whether it is idle, hearing you,
// thinking or speaking. Idea from Rare UI's Matrix Orb, drawn here in ink with SVG and CSS.

export type OrbState = "idle" | "hearing" | "thinking" | "speaking" | "deaf";

const gridSize = 7;
const center = (gridSize - 1) / 2;

// Dots inside the circle, each with its ring number so a ripple can travel outward.
const dots = Array.from({ length: gridSize * gridSize }, (_, index) => {
  const column = index % gridSize;
  const row = Math.floor(index / gridSize);
  const distance = Math.hypot(column - center, row - center);
  return { column, row, ring: Math.round(distance) };
}).filter((dot) => Math.hypot(dot.column - center, dot.row - center) <= center + 0.35);

const stateClass: Record<OrbState, string> = {
  idle: "",
  hearing: "",
  thinking: "orb-thinking",
  speaking: "orb-speaking",
  deaf: "",
};

function dotOpacity(state: OrbState, ring: number): number {
  if (state === "deaf") return 0.22;
  if (state === "hearing") return ring <= 2 ? 1 : 0.85;
  if (state === "idle") return ring === 0 ? 1 : ring === 1 ? 0.8 : ring === 2 ? 0.55 : 0.35;
  return 0.7;
}

export function AssistantOrb({ state, size = 22, label }: { state: OrbState; size?: number; label?: string }) {
  const spacing = 10;
  const extent = gridSize * spacing;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${extent} ${extent}`} role="img" aria-label={label ?? `Assistant ${state}`} className={`shrink-0 text-ink ${stateClass[state]}`}>
      {dots.map((dot) => (
        <circle
          key={`${dot.column}-${dot.row}`}
          className="orb-dot"
          cx={dot.column * spacing + spacing / 2}
          cy={dot.row * spacing + spacing / 2}
          r={3.3}
          fill="currentColor"
          opacity={dotOpacity(state, dot.ring)}
          style={{ "--ring": dot.ring } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}
