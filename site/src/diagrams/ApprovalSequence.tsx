// What happens when an agent asks for a permission, as a sequence: the agent's own hook asks HeyTerm,
// which holds the request open, says it, and answers the hook with your word. Play steps through it;
// the switch shows what a "no" does. The whole sequence is on screen before anything plays.

import { useEffect, useRef, useState } from "react";
import { Section, SectionHeading } from "../pieces.tsx";
import { useReducedMotion } from "./kit.tsx";

type Ending = "approve" | "deny";

interface Message {
  from: Lane;
  to: Lane;
  wide: string;
  narrow: string;
  told: string;
}

type Lane = "agent" | "heyterm" | "you";

const opening: Message[] = [
  { from: "agent", to: "heyterm", wide: "asks to run pnpm install expo-haptics", narrow: "asks to run", told: "mobile wants to run a command. HeyTerm holds the request." },
  { from: "heyterm", to: "you", wide: "says what it wants", narrow: "says it", told: "HeyTerm says it in plain words." },
];

const endings: Record<Ending, Message[]> = {
  approve: [
    { from: "you", to: "heyterm", wide: "\"approve\"", narrow: "\"approve\"", told: "You say approve, or click it." },
    { from: "heyterm", to: "agent", wide: "allowed", narrow: "allowed", told: "The agent gets your yes." },
    { from: "agent", to: "agent", wide: "runs it", narrow: "runs it", told: "mobile carries on." },
  ],
  deny: [
    { from: "you", to: "heyterm", wide: "\"no, add it as a dev dependency\"", narrow: "\"no, …\"", told: "You say no, and why." },
    { from: "heyterm", to: "agent", wide: "denied, with your reason", narrow: "denied", told: "The agent gets your no, and the reason." },
    { from: "agent", to: "agent", wide: "changes course", narrow: "changes course", told: "It tries again your way." },
  ],
};

const stepMilliseconds = 650;

export function ApprovalFlow() {
  const [ending, setEnding] = useState<Ending>("approve");
  // How many messages are drawn; all of them until Play starts over from the first.
  const [shown, setShown] = useState(5);
  const timer = useRef<number | undefined>(undefined);
  const reducedMotion = useReducedMotion();
  const messages = [...opening, ...endings[ending]];
  useEffect(() => () => window.clearInterval(timer.current), []);
  const play = () => {
    window.clearInterval(timer.current);
    if (reducedMotion) return setShown(messages.length);
    setShown(1);
    timer.current = window.setInterval(() => {
      setShown((count) => {
        if (count >= messages.length) {
          window.clearInterval(timer.current);
          return count;
        }
        return count + 1;
      });
    }, stepMilliseconds);
  };
  const current = messages[Math.min(shown, messages.length) - 1]!;
  return (
    <Section id="approvals">
      <SectionHeading title="Approve by voice.">
        <p>HeyTerm answers the agent's own request. Its rules stay in charge.</p>
      </SectionHeading>
      <figure className="mt-10 flex flex-col gap-4 rounded-outer border border-line bg-panel p-3 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 px-1">
          <button type="button" onClick={play} className="press key-lift inline-flex h-9 cursor-pointer items-center gap-2 rounded-inner bg-primary px-3.5 text-meta font-medium text-primary-ink shadow-key hover:bg-primary-hover">
            <PlayGlyph /> Play it
          </button>
          <div role="radiogroup" aria-label="Your answer" className="inline-flex gap-0.5 rounded-inner border border-line bg-tray p-0.5 shadow-tray">
            {(["approve", "deny"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={ending === choice}
                onClick={() => {
                  setEnding(choice);
                  setShown(5);
                }}
                className={`press inline-flex h-8 cursor-pointer items-center rounded-small px-3 text-meta transition-[background-color,color,box-shadow] duration-150 ${ending === choice ? "bg-key text-ink shadow-key" : "text-ink-muted hover:text-ink"}`}
              >
                {choice === "approve" ? "Approve" : "Say no"}
              </button>
            ))}
          </div>
        </div>
        <Sequence messages={messages} shown={shown} layout="wide" />
        <Sequence messages={messages} shown={shown} layout="narrow" />
        <figcaption key={`${ending}-${shown}`} className="status-swap px-1 text-body leading-relaxed text-ink" aria-live="polite">
          {current.told}
        </figcaption>
      </figure>
    </Section>
  );
}

const lanes: Record<"wide" | "narrow", Record<Lane, number>> = {
  wide: { agent: 160, heyterm: 480, you: 800 },
  narrow: { agent: 56, heyterm: 170, you: 284 },
};
const laneNames: Record<Lane, { name: string; detail: string }> = {
  agent: { name: "mobile", detail: "Codex" },
  heyterm: { name: "HeyTerm", detail: "holds it open" },
  you: { name: "You", detail: "by voice" },
};

function Sequence({ messages, shown, layout }: { messages: Message[]; shown: number; layout: "wide" | "narrow" }) {
  const wide = layout === "wide";
  const x = lanes[layout];
  const headWidth = wide ? 176 : 100;
  const headHeight = wide ? 56 : 52;
  const firstRow = wide ? 132 : 128;
  const rowGap = wide ? 52 : 56;
  const rows = messages.map((_, index) => firstRow + index * rowGap);
  const bottom = rows[rows.length - 1]! + (wide ? 40 : 44);
  const height = bottom + 8;
  const width = wide ? 960 : 340;
  // HeyTerm holds the agent's request open from its arrival until it answers it.
  const holdTop = rows[0]! - 8;
  const holdBottom = rows[3]! + 8;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`approval-${layout}-title approval-${layout}-desc`} className={`h-auto w-full ${wide ? "hidden sm:block" : "sm:hidden"}`}>
      <title id={`approval-${layout}-title`}>How a permission is answered</title>
      <desc id={`approval-${layout}-desc`}>The agent's permission hook asks HeyTerm, which holds the request open and tells you; your answer goes back through the same hook, and the agent runs the command or changes course.</desc>
      <defs>
        <marker id={`approval-${layout}-arrow`} viewBox="0 0 8 6" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" className="fill-ink-faint" />
        </marker>
        <marker id={`approval-${layout}-arrow-lit`} viewBox="0 0 8 6" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" className="fill-accent" />
        </marker>
      </defs>
      {(Object.keys(x) as Lane[]).map((lane) => (
        <line key={lane} x1={x[lane]} y1={16 + headHeight} x2={x[lane]} y2={bottom} className="stroke-line-strong" strokeWidth={1} strokeDasharray="4 4" />
      ))}
      <rect x={x.heyterm - 6} y={holdTop} width={12} height={holdBottom - holdTop} rx={3} className={`transition-opacity duration-200 fill-accent/25 stroke-accent ${shown >= 1 ? "opacity-100" : "opacity-0"}`} strokeWidth={1} />
      {(Object.keys(x) as Lane[]).map((lane) => (
        <g key={lane}>
          <rect x={x[lane] - headWidth / 2} y={16} width={headWidth} height={headHeight} rx={8} className={lane === "heyterm" ? "fill-canvas stroke-line-strong" : "fill-key stroke-line-strong"} strokeWidth={1} />
          <text x={x[lane]} y={16 + headHeight / 2 - 2} textAnchor="middle" className={`${lane === "agent" ? "font-mono" : lane === "heyterm" ? "display" : "font-sans"} fill-ink`} fontSize={14} fontWeight={lane === "you" ? 600 : undefined}>
            {laneNames[lane].name}
          </text>
          <text x={x[lane]} y={16 + headHeight / 2 + 15} textAnchor="middle" className="fill-ink-faint font-sans" fontSize={wide ? 12 : 11}>
            {laneNames[lane].detail}
          </text>
        </g>
      ))}
      {messages.map((message, index) => {
        const y = rows[index]!;
        const visible = index < shown;
        const latest = index === shown - 1;
        const label = wide ? message.wide : message.narrow;
        const lit = latest ? "stroke-accent" : "stroke-ink-faint";
        const marker = `url(#approval-${layout}-arrow${latest ? "-lit" : ""})`;
        const fromX = x[message.from];
        if (message.from === message.to) {
          const loopWidth = wide ? 40 : 28;
          return (
            <g key={index} className={`transition-[opacity,translate] duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
              <path d={`M ${fromX + 6} ${y - 12} H ${fromX + loopWidth} V ${y + 12} H ${fromX + 10}`} className={`fill-none ${lit}`} strokeWidth={latest ? 1.6 : 1.2} markerEnd={marker} />
              <text x={fromX + loopWidth + 8} y={y + 4} className={`${latest ? "fill-accent-ink" : "fill-ink-muted"} font-sans`} fontSize={wide ? 13 : 12}>
                {label}
              </text>
            </g>
          );
        }
        const toX = x[message.to];
        const leftToRight = toX > fromX;
        // Arrows stop short of the lifeline, or the hold bar when it is HeyTerm's.
        const startX = fromX + (leftToRight ? 8 : -8);
        const endX = toX + (leftToRight ? -8 : 8);
        return (
          <g key={index} className={`transition-[opacity,translate] duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
            <line x1={startX} y1={y} x2={endX} y2={y} className={lit} strokeWidth={latest ? 1.6 : 1.2} markerEnd={marker} />
            <text x={(fromX + toX) / 2} y={y - 10} textAnchor="middle" className={`${latest ? "fill-accent-ink" : "fill-ink-muted"} ${label.startsWith('"') ? "font-sans italic" : "font-sans"}`} fontSize={wide ? 13 : 12}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.7-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
    </svg>
  );
}
