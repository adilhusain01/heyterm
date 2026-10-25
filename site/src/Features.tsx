// What you get, each shown with a real piece of the app rather than an icon in a box.

import { useState, type ReactNode } from "react";
import { AssistantOrb } from "../../src/web/ui/AssistantOrb.tsx";
import { CheckIcon, SpeakerIcon, SpeakerMutedIcon, SpeakerQuietIcon } from "../../src/web/ui/icons.tsx";
import { Face as SessionAvatar } from "./Face.tsx";
import { Section, SectionHeading } from "./pieces.tsx";
import type { SessionState } from "../../src/shared/types.ts";

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
        <Feature title="An assistant in the middle" piece={<AssistantPiece />}>
          <p>Claude Opus 5.5 runs between you and the agents, on your own Claude Code login, so there is no API key to set up.</p>
          <p>It reads every session, sends them work and tells you what happened, and does anything Claude Code can on your computer: commands, installs, files, the web. It asks you out loud only when Claude Code itself would ask, and remembers your conversation across restarts.</p>
        </Feature>
        <Feature title="Parallel sessions that never collide" piece={<ParallelPiece />}>
          <p>Start a second session in a project that already has one, and it gets a git worktree and a branch of its own, so two agents never edit the same files. Its work waits on that branch for you to merge.</p>
          <p>When a task ends you hear how many files it changed, and "what did api change?" names them, edits made through shell commands included.</p>
        </Feature>
        <Feature title="Hear what matters, and nothing else" piece={<VoicePiece />}>
          <p>On a Mac it speaks with the voice you chose in System Settings, Siri voices included. Elsewhere it uses your browser's voice.</p>
          <p>Nothing is said over your own dictation, and lines wait their turn rather than talking over each other.</p>
        </Feature>
        <Feature title="Every session has a face" piece={<FacesPiece />}>
          <p>Each session gets a face drawn from its name, so you find it at a glance in a crowded sidebar. A badge on the face says what it is doing.</p>
          <p>Fold the sidebar to a rail of faces when the terminals need the room.</p>
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

function AssistantPiece() {
  return (
    <div className="flex flex-col gap-3">
      <p className="ml-auto w-fit rounded-outer bg-raised px-3 py-2 text-body text-ink">what is everyone doing?</p>
      <div className="flex gap-3">
        <AssistantOrb state="speaking" size={26} label="The assistant, speaking" />
        <p className="text-body leading-relaxed text-ink">
          api is refactoring the auth middleware. tests just finished: all 48 pass. mobile is waiting on you to approve a package install. web and docs are idle.
        </p>
      </div>
    </div>
  );
}

function ParallelPiece() {
  return (
    <div className="flex flex-col gap-3">
      <p className="ml-auto w-fit rounded-outer bg-raised px-3 py-2 text-body text-ink">start another session in api</p>
      <p className="flex items-start gap-2 text-small text-ink-muted">
        <span className="mt-1.5 size-1.5 shrink-0 rounded-mark bg-ink-faint" aria-hidden="true" />
        <span>
          Starting api-2 in a copy of the folder of its own, on branch <span className="font-mono whitespace-nowrap text-ink">heyterm/api-2</span>.
        </span>
      </p>
      <p className="flex items-start gap-2 text-small text-ink-muted">
        <span className="mt-1.5 size-1.5 shrink-0 rounded-mark bg-ink-faint" aria-hidden="true" />
        api-2 finished: Added rate limits to the login route. Changed 3 files.
      </p>
      <p className="ml-auto w-fit rounded-outer bg-raised px-3 py-2 text-body text-ink">what did api-2 change?</p>
      <div className="flex gap-3">
        <AssistantOrb state="speaking" size={26} label="The assistant, speaking" />
        <p className="text-body leading-relaxed text-ink">api-2 changed 3 files in its last task: login.ts, limits.ts and login.test.ts. Since the last commit, 64 lines added and 9 removed.</p>
      </div>
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

const faces: Array<{ name: string; state: SessionState; label: string }> = [
  { name: "api", state: "working", label: "Working" },
  { name: "mobile", state: "needs_permission", label: "Needs you" },
  { name: "tests", state: "done", label: "Done" },
  { name: "docs", state: "idle", label: "Idle" },
  { name: "web", state: "failed", label: "Failed" },
  { name: "shop", state: "asked", label: "Asked you" },
];

function FacesPiece() {
  return (
    <ul className="grid grid-cols-3 gap-4">
      {faces.map((face) => (
        <li key={face.name} className="flex flex-col items-center gap-2 text-center">
          <SessionAvatar name={face.name} state={face.state} size={56} />
          <span className="font-mono text-small text-ink">{face.name}</span>
          <span className="-mt-1.5 text-micro text-ink-faint">{face.label}</span>
        </li>
      ))}
    </ul>
  );
}

const extras: Array<{ title: string; text: string }> = [
  { title: "Your own terminals too", text: "Claude sessions you started yourself show up beside HeyTerm's, so their questions reach you too. Say \"open synqed here\" to move one in, conversation and all." },
  { title: "Drop a screenshot on a session", text: "Drag an image onto a session's terminal, or paste one there, and the agent gets it attached, as if you had pasted it yourself." },
  { title: "See what it ran", text: "Every command the assistant runs is a line you can click open for the full command and its output." },
  { title: "Never miss a request", text: "The conversation follows new messages while you are at the end, and always brings a permission or question into view." },
  { title: "Catch me up", text: "After a meeting, one sentence tells you what every session did while you were away." },
  { title: "It notices a quiet session", text: "A session that says nothing for five minutes, or runs one command for ten, is named out loud before you wonder." },
  { title: "Tell them apart", text: "Hover a session for its agent, folder, branch and id, and rename it by voice or with a click." },
  { title: "Copy anything", text: "Select any text, in the conversation or a terminal, and copy it with Cmd+C or Ctrl+C." },
  { title: "Closing means closed", text: "Stop HeyTerm and every session ends. Bring one back later and its conversation picks up where it left off." },
  { title: "Gruvbox, light or dark", text: "The same warm palette as this page, in either theme, with the terminals kept dark so agents stay readable." },
  { title: "macOS, Linux and Windows", text: "One command on each, with the same terminals and the same voice controls." },
  { title: "Uninstall leaves nothing", text: "heyterm uninstall takes its hooks back out of your agents' settings and moves its folder to the Trash." },
];

function Extras() {
  return (
    <ul className="mt-6 grid gap-x-10 gap-y-8 border-t border-line pt-14 sm:grid-cols-2 lg:grid-cols-3">
      {extras.map((extra) => (
        <li key={extra.title} className="flex flex-col gap-2">
          <h3 className="text-title font-medium text-ink">{extra.title}</h3>
          <p className="text-body leading-relaxed text-ink-muted">{extra.text}</p>
        </li>
      ))}
    </ul>
  );
}
