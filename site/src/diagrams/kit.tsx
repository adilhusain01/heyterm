// What every diagram on the page draws with: a beam that travels a connector, connectors that bend
// at right angles, and the reduced-motion check. Colours come from the app's tokens, so the diagrams
// follow the light and dark themes. The beam is Magic UI's Animated Beam (MIT), rewritten without its
// animation library: a gradient window slides along the line, on requestAnimationFrame.

import { useEffect, useRef, useState } from "react";
import { Geometry, type Point } from "./geometry.ts";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export interface BeamRun {
  // Bumped to send the beam again.
  play: number;
  delayMilliseconds: number;
  reverse: boolean;
}

const beamLength = 72;
const beamMilliseconds = 560;

// A straight connector: a quiet rail, lit while it is part of the route shown, and a beam that runs
// along it once each time `run.play` changes. With reduced motion the lit rail says it all.
export function BeamLine({ id, from, to, lit, run }: { id: string; from: Point; to: Point; lit: boolean; run?: BeamRun }) {
  const gradientRef = useRef<SVGLinearGradientElement>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const gradient = gradientRef.current;
    if (!gradient || !run || run.play === 0 || reducedMotion) return;
    const { from: start, to: end } = Geometry.beamWindow(from, to, beamLength, run.reverse);
    const place = (progress: number) => {
      for (const key of ["x1", "y1", "x2", "y2"] as const) gradient.setAttribute(key, String(start[key] + (end[key] - start[key]) * progress));
    };
    place(0);
    let frame = 0;
    let startedAt: number | undefined;
    const timer = window.setTimeout(() => {
      const step = (now: number) => {
        startedAt ??= now;
        const progress = Math.min(1, (now - startedAt) / beamMilliseconds);
        // Ease in and out: the beam leaves and arrives softly and moves fastest in between.
        place(progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2);
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, run.delayMilliseconds);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      place(0);
    };
  }, [run?.play, run?.delayMilliseconds, run?.reverse, from[0], from[1], to[0], to[1], reducedMotion]);
  const window0 = Geometry.beamWindow(from, to, beamLength, run?.reverse ?? false).from;
  const path = Geometry.roundedPath([from, to]);
  return (
    <g>
      <path d={path} className={`fill-none transition-[stroke] duration-200 ${lit ? "stroke-accent" : "stroke-line-strong"}`} strokeWidth={lit ? 1.6 : 1.2} />
      <defs>
        <linearGradient ref={gradientRef} id={id} gradientUnits="userSpaceOnUse" x1={window0.x1} y1={window0.y1} x2={window0.x2} y2={window0.y2}>
          <stop offset="0" style={{ stopColor: "var(--color-accent)", stopOpacity: 0 }} />
          <stop offset="0.55" style={{ stopColor: "var(--color-terminal-orange)", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "var(--color-accent)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {!reducedMotion && <path d={path} fill="none" stroke={`url(#${id})`} strokeWidth={3} strokeLinecap="round" />}
    </g>
  );
}

// Arrowheads for one diagram, quiet and lit; ids are prefixed so two diagrams never share one.
export function ArrowMarkers({ prefix }: { prefix: string }) {
  return (
    <defs>
      <marker id={`${prefix}-arrow`} viewBox="0 0 8 6" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
        <polygon points="0 0, 8 3, 0 6" className="fill-ink-faint" />
      </marker>
      <marker id={`${prefix}-arrow-lit`} viewBox="0 0 8 6" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
        <polygon points="0 0, 8 3, 0 6" className="fill-accent" />
      </marker>
    </defs>
  );
}

// A connector with right-angle bends, for routes that are not straight. `arrow` names the diagram's
// ArrowMarkers prefix when the connector has a direction.
export function Connector({ points, lit = false, dashed = false, arrow, className = "" }: { points: Point[]; lit?: boolean; dashed?: boolean; arrow?: string; className?: string }) {
  return (
    <path
      d={Geometry.roundedPath(points)}
      className={`fill-none transition-[stroke] duration-200 ${lit ? "stroke-accent" : "stroke-line-strong"} ${className}`}
      strokeWidth={lit ? 1.6 : 1.2}
      strokeDasharray={dashed ? "4 4" : undefined}
      markerEnd={arrow ? `url(#${arrow}-arrow${lit ? "-lit" : ""})` : undefined}
    />
  );
}

// A label on a connector, on an opaque patch of the page so the line never shows through it.
export function ConnectorLabel({ x, y, text, anchor = "middle", width }: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end"; width: number }) {
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  return (
    <g>
      <rect x={left - 4} y={y - 12} width={width + 8} height={16} rx={2} className="fill-panel" />
      <text x={x} y={y} textAnchor={anchor} className="fill-ink-faint font-mono" fontSize={11}>
        {text}
      </text>
    </g>
  );
}

// A session's face, from the pictures drawn at build time.
export function FaceImage({ face, x, y, size }: { face: string; x: number; y: number; size: number }) {
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={6} className="fill-raised" />
      <image href={face} x={x} y={y} width={size} height={size} />
    </g>
  );
}
