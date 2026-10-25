// The hero: HeyTerm itself, small and running a scene. A sentence is dictated to Grok, Cursor asks to
// install a package and is approved by voice, and the assistant reports back. Built from the app's
// own pieces (faces, orb, tokens), it loops while on screen and holds its last frame under reduced motion.

import { useEffect, useMemo, useRef, useState } from "react";
import { AssistantOrb, type OrbState } from "../../src/web/ui/AssistantOrb.tsx";
import { Face as SessionAvatar } from "./Face.tsx";
import { CheckIcon } from "../../src/web/ui/icons.tsx";
import { AgentMark } from "./AgentMark.tsx";
import type { SessionState } from "../../src/shared/types.ts";

interface DemoSession {
  name: string;
  agent: string;
  state: SessionState;
}

type ChatLine =
  | { kind: "event"; text: string }
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "request"; text: string; answered: boolean };

interface Scene {
  sessions: DemoSession[];
  barText: string;
  isDictating: boolean;
  orb: OrbState;
  chat: ChatLine[];
  testsPane: string[];
  mobilePane: string[];
}

const stateLabel: Partial<Record<SessionState, string>> = { working: "Working", idle: "Idle", done: "Done", needs_permission: "Needs a permission" };
const stateText: Partial<Record<SessionState, string>> = { working: "text-working", idle: "text-ink-faint", done: "text-finished", needs_permission: "text-permission" };

const firstScene: Scene = {
  sessions: [
    { name: "api", agent: "claude", state: "working" },
    { name: "web", agent: "codex", state: "idle" },
    { name: "docs", agent: "gemini", state: "done" },
    { name: "tests", agent: "grok", state: "idle" },
    { name: "mobile", agent: "cursor", state: "working" },
  ],
  barText: "",
  isDictating: false,
  orb: "idle",
  chat: [{ kind: "event", text: "docs finished: updated the README." }],
  testsPane: ["Grok Build 1.0.70", "Ready in ~/code/shop"],
  mobilePane: ["❯ add the settings screen", "◈ Created app/settings.tsx"],
};

const dictatedTask = "tests, run the unit tests and fix what fails";

// Each step changes the scene at a moment in the loop, in milliseconds.
interface Step {
  at: number;
  change: (scene: Scene) => Scene;
}

function setState(scene: Scene, name: string, state: SessionState): DemoSession[] {
  return scene.sessions.map((session) => (session.name === name ? { ...session, state } : session));
}

function typing(text: string, from: number, duration: number): Step[] {
  const count = 14;
  return Array.from({ length: count + 1 }, (_, index) => ({
    at: from + (duration * index) / count,
    change: (scene: Scene) => ({ ...scene, isDictating: true, orb: "hearing", barText: text.slice(0, Math.round((text.length * index) / count)) }),
  }));
}

const steps: Step[] = [
  ...typing(dictatedTask, 900, 1700),
  {
    at: 2900,
    change: (scene) => ({
      ...scene,
      barText: "",
      isDictating: false,
      orb: "idle",
      sessions: setState(scene, "tests", "working"),
      chat: [...scene.chat, { kind: "user", text: dictatedTask }, { kind: "event", text: "Sent to tests." }],
      testsPane: [...scene.testsPane, `❯ ${dictatedTask.replace("tests, ", "")}`],
    }),
  },
  { at: 3600, change: (scene) => ({ ...scene, testsPane: [...scene.testsPane, "◆ Running pnpm test"] }) },
  { at: 4300, change: (scene) => ({ ...scene, testsPane: [...scene.testsPane, "  ✗ cart › applies the coupon", "  ✗ cart › rounds the total"] }) },
  {
    at: 5000,
    change: (scene) => ({
      ...scene,
      orb: "speaking",
      sessions: setState(scene, "mobile", "needs_permission"),
      chat: [...scene.chat, { kind: "request", text: "mobile wants to run pnpm install expo-haptics", answered: false }],
      mobilePane: [...scene.mobilePane, "? Run pnpm install expo-haptics"],
    }),
  },
  { at: 6400, change: (scene) => ({ ...scene, orb: "idle" }) },
  ...typing("approve", 6900, 500),
  {
    at: 7700,
    change: (scene) => ({
      ...scene,
      barText: "",
      isDictating: false,
      orb: "idle",
      sessions: setState(scene, "mobile", "working"),
      chat: [...scene.chat.map((line) => (line.kind === "request" ? { ...line, answered: true } : line)), { kind: "user", text: "Approve mobile" }],
      mobilePane: [...scene.mobilePane, "◆ Running pnpm install expo-haptics"],
    }),
  },
  { at: 8600, change: (scene) => ({ ...scene, testsPane: [...scene.testsPane, "◈ Edited src/cart/totals.ts", "◆ Running pnpm test"], mobilePane: [...scene.mobilePane, "◈ Edited app/settings.tsx"] }) },
  { at: 9500, change: (scene) => ({ ...scene, sessions: setState(scene, "tests", "done"), testsPane: [...scene.testsPane, "  ✓ 48 passed"] }) },
  {
    at: 10300,
    change: (scene) => ({
      ...scene,
      orb: "speaking",
      chat: [...scene.chat, { kind: "assistant", text: "tests is done. It fixed the two failing cart tests, and all 48 pass." }],
    }),
  },
  { at: 12600, change: (scene) => ({ ...scene, orb: "idle" }) },
];
const loopLength = 14_000;

function sceneAt(time: number): Scene {
  return steps.filter((step) => step.at <= time).reduce((scene, step) => step.change(scene), firstScene);
}

function usePlayhead(): number {
  const [time, setTime] = useState(0);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useEffect(() => {
    if (reducedMotion) {
      setTime(loopLength - 1);
      return;
    }
    let visible = true;
    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    const observer = new IntersectionObserver(([entry]) => (visible = entry?.isIntersecting ?? true));
    if (holderRef.current) observer.observe(holderRef.current);
    const tick = (now: number) => {
      if (visible && !document.hidden) elapsed = (elapsed + (now - last)) % loopLength;
      last = now;
      setTime((previous) => (Math.abs(previous - elapsed) > 60 ? elapsed : previous));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reducedMotion]);
  return time;
}

export function LiveDemo() {
  const time = usePlayhead();
  const scene = sceneAt(time);
  return (
    <div
      role="img"
      aria-label="HeyTerm running five coding agents: a sentence is dictated to Grok, Cursor asks to install a package and is approved by voice, and the assistant reports that the tests pass."
      className="relative overflow-hidden rounded-outer border border-line-strong bg-canvas text-left"
    >
      <div aria-hidden className="grid grid-cols-1 md:h-[500px] md:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[190px_minmax(0,1fr)_270px]">
        <Sidebar sessions={scene.sessions} />
        <div className="hidden min-w-0 flex-col gap-2 p-2 md:flex">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-2">
            <Pane title="tests" agent="grok" session={scene.sessions[3]!} lines={scene.testsPane} />
            <Pane title="mobile" agent="cursor" session={scene.sessions[4]!} lines={scene.mobilePane} className="hidden xl:flex" />
          </div>
          <Bar text={scene.barText} isDictating={scene.isDictating} orb={scene.orb} />
        </div>
        <Conversation chat={scene.chat} orb={scene.orb} />
        <div className="p-2 md:hidden">
          <Bar text={scene.barText} isDictating={scene.isDictating} orb={scene.orb} />
        </div>
      </div>
    </div>
  );
}

function Sidebar({ sessions }: { sessions: DemoSession[] }) {
  return (
    <div className="flex gap-1 overflow-hidden border-b border-line bg-panel p-2 md:flex-col md:border-r md:border-b-0">
      <p className="hidden px-2 pt-1 pb-1.5 text-small font-medium text-ink-muted md:block">Sessions</p>
      {sessions.map((session) => (
        <div key={session.name} className={`flex shrink-0 items-center gap-2 rounded-inner px-1.5 py-1 transition-colors duration-300 ${session.state === "needs_permission" ? "bg-raised" : ""}`}>
          <SessionAvatar name={session.name} state={session.state} size={26} />
          <span className="hidden min-w-0 flex-col md:flex">
            <span className="flex items-center gap-1.5 font-mono text-small text-ink">
              {session.name}
              <AgentMark kind={session.agent} size={11} className="text-ink-faint" />
            </span>
            <span key={session.state} className={`status-swap text-micro ${stateText[session.state] ?? "text-ink-faint"}`}>
              {stateLabel[session.state]}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Pane({ title, agent, session, lines, className = "flex" }: { title: string; agent: string; session: DemoSession; lines: string[]; className?: string }) {
  return (
    <div className={`${className} min-h-0 flex-col overflow-hidden rounded-inner border border-line bg-terminal`}>
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-panel px-2.5">
        <SessionAvatar name={title} state={session.state} size={18} />
        <span className="font-mono text-small text-ink">{title}</span>
        <AgentMark kind={agent} size={11} className="text-ink-faint" />
        <span className={`text-micro ${stateText[session.state] ?? ""}`}>{stateLabel[session.state]}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1 overflow-hidden px-3 py-2.5 font-mono text-[11.5px] leading-snug text-terminal-ink">
        {lines.map((line, index) => (
          <p key={`${index}-${line}`} className={`line-in truncate ${line.startsWith("  ✗") ? "text-terminal-red" : line.startsWith("  ✓") ? "text-terminal-green" : line.startsWith("?") ? "text-terminal-orange" : line.startsWith("❯") ? "text-terminal-bright" : ""}`}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function Bar({ text, isDictating, orb }: { text: string; isDictating: boolean; orb: OrbState }) {
  return (
    <div className={`flex h-11 shrink-0 items-center gap-2.5 rounded-outer border bg-tray px-3 shadow-tray transition-colors duration-200 ${isDictating ? "border-accent/60" : "border-line-strong"}`}>
      <AssistantOrb state={orb} size={20} label="" />
      <span className="min-w-0 flex-1 truncate text-meta text-ink">
        {text || <span className="text-ink-faint">Hold your dictation key and talk</span>}
        {isDictating && <span className="caret ml-px inline-block h-4 w-px translate-y-0.5 bg-ink" />}
      </span>
      <span className="hidden rounded-tiny border border-line px-1.5 font-mono text-micro leading-5 text-ink-faint sm:block">Fn</span>
    </div>
  );
}

function Conversation({ chat, orb }: { chat: ChatLine[]; orb: OrbState }) {
  const recent = chat.slice(-6);
  return (
    <div className="flex h-[300px] min-h-0 flex-col border-line bg-panel md:col-span-2 md:h-auto lg:col-span-1 lg:border-l">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-small font-medium text-ink">HeyTerm</span>
        <span key={orb} className="status-swap text-micro text-ink-faint">
          {orb === "speaking" ? "Speaking" : orb === "hearing" ? "Hearing you" : "Listening"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden p-3">
        {recent.map((line, index) => (
          <ChatRow key={`${chat.length - recent.length + index}-${line.kind}`} line={line} />
        ))}
      </div>
    </div>
  );
}

function ChatRow({ line }: { line: ChatLine }) {
  if (line.kind === "user") return <p className="enter-rise ml-auto w-fit max-w-[88%] rounded-inner bg-raised px-2.5 py-1.5 text-small text-ink">{line.text}</p>;
  if (line.kind === "assistant") return <p className="enter-rise text-small leading-relaxed text-ink">{line.text}</p>;
  if (line.kind === "event") return <p className="enter-rise flex items-baseline gap-1.5 text-micro leading-snug text-ink-muted before:size-1 before:shrink-0 before:rounded-full before:bg-ink-faint before:content-['']">{line.text}</p>;
  if (line.answered) {
    return (
      <p className="flex items-center gap-1.5 text-micro text-ink-muted">
        <span className="min-w-0 flex-1 truncate">{line.text}</span>
        <CheckIcon size={11} />
        Answered
      </p>
    );
  }
  return (
    <div className="enter-rise flex flex-col gap-2 rounded-inner border border-line-strong bg-canvas p-2.5">
      <p className="text-small text-ink">{line.text}</p>
      <div className="flex items-center gap-1.5">
        <span className="rounded-small bg-primary px-2 py-0.5 text-micro leading-5 font-medium text-primary-ink">Approve</span>
        <span className="rounded-small border border-line bg-key px-2 py-0.5 text-micro leading-5 text-ink">Deny</span>
        <span className="text-micro text-ink-faint">or say "approve"</span>
      </div>
    </div>
  );
}
