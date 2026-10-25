// How it works, drawn: your words reach HeyTerm, which sends them to a session at once or to the
// assistant, and brings back what a session needs. Each step lights its route and runs a beam along
// it when chosen. Wide and phone layouts are drawn apart, so the text never shrinks out of reach.

import { useState } from "react";
import { AssistantOrb } from "../../../src/web/ui/AssistantOrb.tsx";
import { faces } from "../faces.generated.ts";
import { SaidLine } from "../pieces.tsx";
import { BeamLine, FaceImage, type BeamRun } from "./kit.tsx";


type SessionName = "api" | "mobile" | "shop";
type Line = "you" | SessionName;
type Part = "fast" | "assistant";

interface StepBeam {
  line: Line;
  reverse: boolean;
  delayMilliseconds: number;
}

interface Step {
  title: string;
  text: string;
  said: string;
  heard: string;
  part: Part;
  beams: StepBeam[];
  states: Record<SessionName, SessionStatus>;
}

type SessionStatus = { label: string; tone: "working" | "permission" | "idle" };

const agentLabels: Record<SessionName, string> = { api: "Claude Code", mobile: "Codex", shop: "Grok Build" };

const steps: Step[] = [
  {
    title: "Start them by voice",
    text: "Say which agent and which project. HeyTerm opens it in its own terminal on your computer, with a face of its own.",
    said: "start a grok session in shop and run the tests",
    heard: "Starting shop with Grok Build. It gets the task once it is ready.",
    part: "fast",
    beams: [
      { line: "you", reverse: false, delayMilliseconds: 0 },
      { line: "shop", reverse: false, delayMilliseconds: 420 },
    ],
    states: { api: { label: "Working", tone: "working" }, mobile: { label: "Working", tone: "working" }, shop: { label: "Starting", tone: "idle" } },
  },
  {
    title: "Talk to any of them",
    text: "Name a session and your words go straight to it. Anything else goes to the assistant in the middle, which reads every session and answers you out loud.",
    said: "what is everyone doing?",
    heard: "api is refactoring the auth middleware, shop is running the tests, and mobile wants to install a package.",
    part: "assistant",
    beams: [
      { line: "you", reverse: false, delayMilliseconds: 0 },
      { line: "api", reverse: true, delayMilliseconds: 420 },
      { line: "mobile", reverse: true, delayMilliseconds: 420 },
      { line: "shop", reverse: true, delayMilliseconds: 420 },
      { line: "you", reverse: true, delayMilliseconds: 900 },
    ],
    states: { api: { label: "Working", tone: "working" }, mobile: { label: "Needs a permission", tone: "permission" }, shop: { label: "Working", tone: "working" } },
  },
  {
    title: "Answer when one needs you",
    text: "A permission, a question or a folder to trust is said out loud in plain words and shows up in the conversation. Answer there, or just say so.",
    said: "approve",
    heard: "mobile wants to run pnpm install expo-haptics. Approved, so it carries on.",
    part: "fast",
    beams: [
      { line: "mobile", reverse: true, delayMilliseconds: 0 },
      { line: "you", reverse: true, delayMilliseconds: 420 },
      { line: "you", reverse: false, delayMilliseconds: 1100 },
      { line: "mobile", reverse: false, delayMilliseconds: 1520 },
    ],
    states: { api: { label: "Working", tone: "working" }, mobile: { label: "Working", tone: "working" }, shop: { label: "Working", tone: "working" } },
  },
];

const toneClass: Record<SessionStatus["tone"], string> = { working: "fill-working", permission: "fill-permission", idle: "fill-ink-faint" };

export function HowItWorksDiagram() {
  const [chosen, setChosen] = useState(0);
  const [play, setPlay] = useState(0);
  const step = steps[chosen]!;
  const choose = (index: number) => {
    setChosen(index);
    setPlay((count) => count + 1);
  };
  return (
    <div className="mt-12 flex flex-col gap-6">
      <figure className="flex flex-col gap-4 rounded-outer border border-line bg-panel p-3 sm:p-6">
        <WideRouting step={step} play={play} />
        <NarrowRouting step={step} play={play} />
        <figcaption className="flex items-start gap-3 px-1 sm:px-2">
          <AssistantOrb state="speaking" size={24} label="HeyTerm, speaking" />
          <p key={chosen} className="status-swap text-body leading-relaxed text-ink" aria-live="polite">
            {step.heard}
          </p>
        </figcaption>
      </figure>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((candidate, index) => {
          const selected = index === chosen;
          return (
            <li key={candidate.title} className="flex">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => choose(index)}
                className={`press flex w-full cursor-pointer flex-col gap-3 rounded-outer border p-5 text-left transition-[background-color,border-color,box-shadow] duration-200 ${selected ? "border-accent/60 bg-key shadow-key" : "border-line bg-canvas hover:bg-key"}`}
              >
                <span className="flex items-baseline gap-3">
                  <span className={`display text-[24px] ${selected ? "text-accent-ink" : "text-ink-faint"}`} aria-hidden>
                    {index + 1}
                  </span>
                  <span className="text-title font-medium text-ink">{candidate.title}</span>
                </span>
                <span className="text-body leading-relaxed text-ink-muted">{candidate.text}</span>
                <SaidLine>{candidate.said}</SaidLine>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function beamFor(step: Step, line: Line, play: number): BeamRun | undefined {
  // A line can carry two beams in one step (there and back); the later one is the one drawn.
  const beams = step.beams.filter((beam) => beam.line === line);
  const last = beams[beams.length - 1];
  return last ? { play: play * 10 + beams.length, delayMilliseconds: last.delayMilliseconds, reverse: last.reverse } : undefined;
}

function isLit(step: Step, line: Line): boolean {
  return step.beams.some((beam) => beam.line === line);
}

// The wide layout: you on the left, HeyTerm in the middle, the sessions on the right.
function WideRouting({ step, play }: { step: Step; play: number }) {
  const sessions: Array<{ name: SessionName; y: number }> = [
    { name: "api", y: 68 },
    { name: "mobile", y: 164 },
    { name: "shop", y: 260 },
  ];
  return (
    <svg viewBox="0 48 960 304" role="img" aria-labelledby="routing-wide-title routing-wide-desc" className="hidden h-auto w-full sm:block">
      <title id="routing-wide-title">How your words reach the sessions</title>
      <desc id="routing-wide-desc">You talk to HeyTerm, whose fast path sends named commands straight to a session and whose assistant handles everything else; it reads the sessions api, mobile and shop and says what they need.</desc>
      <BeamLine id="wide-beam-you" from={[192, 200]} to={[312, 200]} lit={isLit(step, "you")} run={beamFor(step, "you", play)} />
      {sessions.map((session) => (
        <BeamLine key={session.name} id={`wide-beam-${session.name}`} from={[584, session.y + 36]} to={[720, session.y + 36]} lit={isLit(step, session.name)} run={beamFor(step, session.name, play)} />
      ))}
      <YouNode x={24} y={152} width={168} height={96} />
      <rect x={312} y={72} width={272} height={256} rx={12} className="fill-canvas stroke-line-strong" strokeWidth={1} />
      <text x={336} y={104} className="display fill-ink" fontSize={16}>
        HeyTerm
      </text>
      <PartNode x={336} y={120} width={224} title="Fast path" detail="commands that name a session" lit={step.part === "fast"} />
      <PartNode x={336} y={224} width={224} title="Assistant" detail="Opus 5.5, your Claude login" lit={step.part === "assistant"} />
      {sessions.map((session) => (
        <SessionNode key={session.name} name={session.name} x={720} y={session.y} width={216} height={72} status={step.states[session.name]} layout="wide" />
      ))}
    </svg>
  );
}

// The phone layout: the same parts top to bottom, the sessions side by side.
function NarrowRouting({ step, play }: { step: Step; play: number }) {
  const sessions: Array<{ name: SessionName; x: number }> = [
    { name: "api", x: 12 },
    { name: "mobile", x: 120 },
    { name: "shop", x: 228 },
  ];
  return (
    <svg viewBox="0 0 340 568" role="img" aria-labelledby="routing-narrow-title routing-narrow-desc" className="h-auto w-full sm:hidden">
      <title id="routing-narrow-title">How your words reach the sessions</title>
      <desc id="routing-narrow-desc">You talk to HeyTerm, whose fast path sends named commands straight to a session and whose assistant handles everything else; it reads the sessions api, mobile and shop and says what they need.</desc>
      <BeamLine id="narrow-beam-you" from={[170, 88]} to={[170, 136]} lit={isLit(step, "you")} run={beamFor(step, "you", play)} />
      {sessions.map((session) => (
        <BeamLine key={session.name} id={`narrow-beam-${session.name}`} from={[session.x + 50, 364]} to={[session.x + 50, 436]} lit={isLit(step, session.name)} run={beamFor(step, session.name, play)} />
      ))}
      <YouNode x={88} y={16} width={164} height={72} />
      <rect x={24} y={136} width={292} height={228} rx={12} className="fill-canvas stroke-line-strong" strokeWidth={1} />
      <text x={44} y={168} className="display fill-ink" fontSize={16}>
        HeyTerm
      </text>
      <PartNode x={44} y={188} width={252} title="Fast path" detail="commands that name a session" lit={step.part === "fast"} height={68} />
      <PartNode x={44} y={272} width={252} title="Assistant" detail="Opus 5.5, your Claude login" lit={step.part === "assistant"} height={68} />
      {sessions.map((session) => (
        <SessionNode key={session.name} name={session.name} x={session.x} y={436} width={100} height={116} status={step.states[session.name]} layout="narrow" />
      ))}
    </svg>
  );
}

function YouNode({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const centerY = y + height / 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} className="fill-raised stroke-line-strong" strokeWidth={1} />
      <MicrophoneGlyph x={x + 20} y={centerY - 12} />
      <text x={x + 52} y={centerY - 2} className="fill-ink font-sans" fontSize={14} fontWeight={600}>
        You
      </text>
      <text x={x + 52} y={centerY + 16} className="fill-ink-muted font-sans" fontSize={12}>
        voice or keyboard
      </text>
    </g>
  );
}

function PartNode({ x, y, width, title, detail, lit, height = 80 }: { x: number; y: number; width: number; title: string; detail: string; lit: boolean; height?: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        className={`transition-[fill,stroke] duration-200 ${lit ? "fill-key stroke-accent" : "fill-panel stroke-line"}`}
        strokeWidth={lit ? 1.6 : 1}
      />
      <text x={x + 16} y={y + height / 2 - 4} className="fill-ink font-sans" fontSize={14} fontWeight={600}>
        {title}
      </text>
      <text x={x + 16} y={y + height / 2 + 16} className="fill-ink-muted font-sans" fontSize={12}>
        {detail}
      </text>
    </g>
  );
}

function SessionNode({ name, x, y, width, height, status, layout }: { name: SessionName; x: number; y: number; width: number; height: number; status: SessionStatus; layout: "wide" | "narrow" }) {
  const face = faces[name] ?? "";
  if (layout === "narrow") {
    const centerX = x + width / 2;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={8} className="fill-key stroke-line-strong" strokeWidth={1} />
        <FaceImage face={face} x={centerX - 20} y={y + 12} size={40} />
        <text x={centerX} y={y + 72} textAnchor="middle" className="fill-ink font-mono" fontSize={13}>
          {name}
        </text>
        <text x={centerX} y={y + 90} textAnchor="middle" className={`transition-[fill] duration-200 ${toneClass[status.tone]} font-sans`} fontSize={11}>
          {status.label === "Needs a permission" ? "Needs you" : status.label}
        </text>
        <text x={centerX} y={y + 106} textAnchor="middle" className="fill-ink-faint font-sans" fontSize={11}>
          {agentLabels[name]}
        </text>
      </g>
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} className="fill-key stroke-line-strong" strokeWidth={1} />
      <FaceImage face={face} x={x + 16} y={y + 16} size={40} />
      <text x={x + 68} y={y + 32} className="fill-ink font-mono" fontSize={14}>
        {name}
      </text>
      <text x={x + width - 16} y={y + 32} textAnchor="end" className="fill-ink-faint font-sans" fontSize={12}>
        {agentLabels[name]}
      </text>
      <text x={x + 68} y={y + 52} className={`transition-[fill] duration-200 ${toneClass[status.tone]} font-sans`} fontSize={12}>
        {status.label}
      </text>
    </g>
  );
}

function MicrophoneGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="fill-none stroke-ink" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x={8} y={2} width={8} height={13} rx={4} />
      <path d="M4 11a8 8 0 0 0 16 0" />
      <path d="M12 19v3" />
    </g>
  );
}


