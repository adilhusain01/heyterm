// What you get, each shown with a real piece of the app rather than an icon in a box.

import { useState, type ReactNode } from "react";
import { CheckIcon, SpeakerIcon, SpeakerMutedIcon, SpeakerQuietIcon } from "../../src/web/ui/icons.tsx";
import { Face as SessionAvatar } from "./Face.tsx";
import { StatePiece } from "./diagrams/StateDiagram.tsx";
import { WorktreePiece } from "./diagrams/WorktreeDiagram.tsx";
import { Extras } from "./Extras.tsx";
import { Section, SectionHeading } from "./pieces.tsx";

function Feature({ title, children, piece }: { title: string; children: ReactNode; piece: ReactNode }) {
  return (
    <div className="grid items-center gap-8 border-t border-line py-14 first:border-t-0 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-14">
      <div className="flex max-w-[48ch] flex-col gap-3">
        <h3 className="display text-[22px] leading-tight text-ink">{title}</h3>
        <div className="flex flex-col gap-3 text-body leading-relaxed text-ink-muted">{children}</div>
      </div>
      <div className="rounded-outer border border-line bg-panel p-5 sm:p-6">{piece}</div>
    </div>
  );
}

export function Features() {
  return (
    <Section>
      <SectionHeading title="Everything in one place, nothing in your way." />
      <div className="mt-6">
        <Feature title="Requests arrive in the conversation" piece={<RequestPiece />}>
          <p>When a session needs a permission, an answer or a folder trusted, it shows up as a message where you are already looking, with what it wants in plain words.</p>
          <p>Answer with the buttons or out loud. Your answer appears as your own reply, and the request settles so the thread still reads.</p>
        </Feature>
        <Feature title="Parallel sessions that never collide" piece={<WorktreePiece />}>
          <p>Start a second session in a project that already has one, and it gets a git worktree and a branch of its own, so two agents never edit the same files. Its work waits on that branch for you to merge.</p>
          <p>When a task ends you hear how many files it changed, and "what did api change?" names them, edits made through shell commands included.</p>
        </Feature>
        <Feature title="Hear what matters, and nothing else" piece={<VoicePiece />}>
          <p>On a Mac it speaks with the voice you chose in System Settings, Siri voices included. Elsewhere it uses your browser's voice.</p>
          <p>Nothing is said over your own dictation, and lines wait their turn rather than talking over each other.</p>
        </Feature>
        <Feature title="Every session has a face" piece={<StatePiece />}>
          <p>Each session gets a face drawn from its name, so you find it at a glance in a crowded sidebar. A badge on the face says what it is doing.</p>
          <p>Its state comes from the agent's own hooks, never from reading the screen. Pick a state to see what you hear and what you can say.</p>
        </Feature>
      </div>
      <Extras />
    </Section>
  );
}

function RequestPiece() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 rounded-outer border border-line-strong bg-canvas p-3.5">
        <div className="flex items-center gap-2 text-meta">
          <SessionAvatar name="mobile" state="needs_permission" size={22} />
          <span className="font-mono text-ink">mobile</span>
          <span className="text-permission">Needs a permission</span>
          <span className="ml-auto font-mono text-small text-ink-faint">12s</span>
        </div>
        <p className="text-body text-ink">Wants to run a command</p>
        <p className="rounded-inner border border-line bg-tray px-2.5 py-2 font-mono text-small text-ink shadow-tray">pnpm install expo-haptics</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-inner bg-primary px-2.5 py-1 text-meta font-medium text-primary-ink shadow-key">Approve</span>
          <span className="rounded-inner border border-line bg-key px-2.5 py-1 text-meta text-ink shadow-key">Deny</span>
          <span className="ml-1 text-small text-ink-faint">Or say "approve", or "no" and why</span>
        </div>
      </div>
      <p className="ml-auto w-fit rounded-outer bg-raised px-3 py-2 text-body text-ink">Approve mobile</p>
      <p className="flex items-center gap-1.5 text-small text-ink-muted">
        <CheckIcon size={13} /> Approved. mobile carries on.
      </p>
    </div>
  );
}

const voiceModes = [
  { mode: "Speaking", icon: SpeakerIcon, says: "Says everything: what finished, what failed, what each session needs." },
  { mode: "Quiet", icon: SpeakerQuietIcon, says: "Says only permissions and questions. The rest stays on screen." },
  { mode: "Muted", icon: SpeakerMutedIcon, says: "Says nothing. A short sound still tells you something changed." },
];

function VoicePiece() {
  const [chosen, setChosen] = useState(0);
  const current = voiceModes[chosen]!;
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="How much HeyTerm says" className="inline-flex gap-0.5 self-start rounded-inner border border-line bg-tray p-0.5 shadow-tray">
        {voiceModes.map((voice, index) => {
          const Icon = voice.icon;
          const selected = index === chosen;
          return (
            <button
              key={voice.mode}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChosen(index)}
              className={`press inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-small px-3 text-meta transition-[background-color,color,box-shadow] duration-150 ${selected ? "bg-key text-ink shadow-key" : "text-ink-muted hover:text-ink"}`}
            >
              <Icon size={14} />
              {voice.mode}
            </button>
          );
        })}
      </div>
      <p key={current.mode} className="status-swap text-body text-ink">
        {current.says}
      </p>
      <p className="text-small text-ink-faint">Or say "be quiet", "mute" or "talk to me".</p>
    </div>
  );
}
