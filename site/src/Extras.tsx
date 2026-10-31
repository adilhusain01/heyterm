// The smaller things HeyTerm does, in three groups, each card with a slice of the real interface above
// its words. A few of the slices answer a press the way the app does; none moves on its own.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AssistantOrb } from "../../src/web/ui/AssistantOrb.tsx";
import { ArrowDownIcon, BringBackIcon, CheckIcon, CloseIcon, PencilIcon } from "../../src/web/ui/icons.tsx";
import { Face } from "./Face.tsx";
import { AnyFolderPiece, EvenGridPiece, FollowsThePanePiece, FullAccessPiece, ServerSessionsPiece, UpdatesKeepSessionsPiece } from "./ReachPieces.tsx";
import { ThemeToggle } from "./pieces.tsx";

type Span = "wide" | "narrow" | "narrow-last";

const spanClass: Record<Span, string> = {
  wide: "lg:col-span-3",
  narrow: "lg:col-span-2",
  // The odd one out of a group spans the row at two columns, so no card sits alone beside a gap.
  "narrow-last": "sm:col-span-2 lg:col-span-2",
};

function Card({ title, span, piece, children }: { title: string; span: Span; piece: ReactNode; children: ReactNode }) {
  return (
    <li className={`flex min-w-0 flex-col rounded-outer border border-line bg-panel p-1 ${spanClass[span]}`}>
      <div className="flex h-[156px] min-w-0 flex-col justify-center overflow-hidden rounded-inner bg-canvas px-4 py-3 shadow-tray">{piece}</div>
      <div className="flex flex-col gap-1 px-5 pt-4 pb-5">
        <h4 className="text-title font-medium text-ink">{title}</h4>
        <p className="text-meta leading-relaxed text-ink-muted">{children}</p>
      </div>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="display text-[22px] leading-tight text-ink">{title}</h3>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">{children}</ul>
    </div>
  );
}

export function Extras() {
  return (
    <div className="mt-6 flex flex-col gap-16 border-t border-line pt-16">
      <Group title="Every kind of session, side by side">
        <Card title="Your own terminals too" span="wide" piece={<OwnTerminalPiece />}>
          Claude sessions from your own terminal get a pane when they need you. Open here moves one in.
        </Card>
        <Card title="A plain terminal too" span="wide" piece={<PlainTerminalPiece />}>
          Your own shell in a pane. You or the assistant can run commands in it.
        </Card>
        <Card title="Any folder" span="wide" piece={<AnyFolderPiece />}>
          Pick a folder, or just say its name.
        </Card>
        <Card title="Your server's sessions too" span="wide" piece={<ServerSessionsPiece />}>
          Run HeyTerm on your VPS and its sessions show up here.
        </Card>
        <Card title="A grid that stays even" span="wide" piece={<EvenGridPiece />}>
          Four sessions sit two by two, never three and one.
        </Card>
        <Card title="Fits the pane you use" span="wide" piece={<FollowsThePanePiece />}>
          Open a session in two tabs. The terminal follows the one you type in.
        </Card>
        <Card title="Tell them apart" span="narrow" piece={<DetailsPiece />}>
          Hover for the details. Rename by voice or click.
        </Card>
        <Card title="Drop a screenshot on a session" span="narrow" piece={<DropPiece />}>
          Drop or paste an image onto any session.
        </Card>
        <Card title="Copy anything" span="narrow-last" piece={<CopyPiece />}>
          Select and copy, even in a terminal.
        </Card>
      </Group>
      <Group title="Nothing slips past you">
        <Card title="Never miss a request" span="wide" piece={<RequestInViewPiece />}>
          Requests always scroll into view.
        </Card>
        <Card title="See what it ran" span="wide" piece={<CommandOutputPiece />}>
          Open any command it ran to see the output.
        </Card>
        <Card title="Catch me up" span="narrow" piece={<CatchUpPiece />}>
          One sentence on what happened while you were away.
        </Card>
        <Card title="It notices a quiet session" span="narrow" piece={<QuietPiece />}>
          Five quiet minutes, and it tells you.
        </Card>
        <Card title="It recovers by itself" span="narrow-last" piece={<RecoverPiece />}>
          Sleep the Mac, or press Ctrl+Z in a session. Both come back on their own.
        </Card>
      </Group>
      <Group title="Yours, and easy to leave">
        <Card title="Closing means closed" span="wide" piece={<BringBackPiece />}>
          Bring any session back where it left off.
        </Card>
        <Card title="Updates keep your sessions" span="wide" piece={<UpdatesKeepSessionsPiece />}>
          Update or restart HeyTerm. Your sessions keep working.
        </Card>
        <Card title="Full access, if you want it" span="wide" piece={<FullAccessPiece />}>
          Let the assistant act without asking, or keep it asking.
        </Card>
        <Card title="Gruvbox, light or dark" span="wide" piece={<ThemePiece />}>
          Warm colors, in light or dark.
        </Card>
        <Card title="macOS, Linux and Windows" span="wide" piece={<PlatformsPiece />}>
          One command on each.
        </Card>
        <Card title="Uninstall leaves nothing" span="wide" piece={<UninstallPiece />}>
          One command removes everything it added.
        </Card>
      </Group>
    </div>
  );
}

// A sidebar row for a session from your own terminal; Open here moves it in, as the pane's button does.
function OwnTerminalPiece() {
  const [movedIn, setMovedIn] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-inner bg-raised px-2.5 py-2">
        <Face name="api" state="working" size={28} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-meta text-ink">api</span>
            <span key={String(movedIn)} className="status-swap text-small text-ink-faint">
              {movedIn ? "in HeyTerm" : "own terminal"}
            </span>
          </span>
          <span className="text-small text-working">Working</span>
        </span>
        <button
          type="button"
          onClick={() => setMovedIn(!movedIn)}
          className="press key-lift inline-flex h-7 cursor-pointer items-center rounded-small border border-line-strong bg-key px-2.5 text-small text-ink shadow-key hover:bg-key-hover"
        >
          {movedIn ? "Undo" : "Open here"}
        </button>
      </div>
      <p className="text-small text-ink-faint">{movedIn ? "Same conversation, now in HeyTerm." : "Its questions already reach you."}</p>
    </div>
  );
}

function PlainTerminalPiece() {
  return (
    <div className="flex flex-col overflow-hidden rounded-small bg-terminal font-mono text-small leading-relaxed text-terminal-ink">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="text-terminal-bright">synqed-terminal</span>
        <span className="text-terminal-ink/70">terminal</span>
      </div>
      <div className="px-3 py-2">
        <p>
          <span className="text-terminal-ink/70">synqed %</span> npm test
        </p>
        <p className="text-terminal-green">✓ 48 passed</p>
        <p>
          <span className="text-terminal-ink/70">synqed %</span> <span className="caret">▌</span>
        </p>
      </div>
    </div>
  );
}

function DetailsPiece() {
  const facts = [
    ["Agent", "Codex"],
    ["Folder", "~/Projects/api"],
    ["Branch", "heyterm/api-2"],
  ];
  return (
    <div className="flex flex-col gap-2 rounded-inner border border-line-strong bg-key p-2.5">
      <div className="flex items-center gap-2">
        <Face name="api-2" state="working" size={22} />
        <span className="font-mono text-meta text-ink">api-2</span>
        <PencilIcon size={13} className="ml-auto text-ink-faint" />
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-small">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-faint">{label}</dt>
            <dd className="truncate font-mono text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DropPiece() {
  return (
    <div className="relative flex h-full items-center justify-center rounded-small border border-dashed border-accent bg-accent/8">
      <span className="absolute top-2.5 left-3 font-mono text-small text-ink-faint">mobile</span>
      <span className="flex items-center gap-2 rounded-small border border-line-strong bg-key px-2.5 py-1.5 text-small text-ink">
        <ImageGlyph /> login-bug.png
      </span>
      <span className="absolute bottom-2.5 text-small text-accent-ink">Drop to attach the image to mobile</span>
    </div>
  );
}

function CopyPiece() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body leading-relaxed text-ink">
        api changed <span className="rounded-mark bg-accent/28">3 files: login.ts, limits.ts</span> and login.test.ts.
      </p>
      <span className="flex items-center gap-1.5 text-small text-ink-faint">
        <Key>⌘</Key>
        <Key>C</Key>
        <span className="ml-1">copies the selection</span>
      </span>
    </div>
  );
}

function RequestInViewPiece() {
  return (
    <div className="flex flex-col gap-2">
      <p className="truncate text-small text-ink-faint">tests finished: all 48 pass.</p>
      <p className="truncate text-small text-ink-faint">api is refactoring the auth middleware.</p>
      <div className="flex flex-col gap-2 rounded-inner border border-permission/50 bg-key p-2.5">
        <span className="flex items-center gap-2 text-small">
          <Face name="mobile" state="needs_permission" size={20} />
          <span className="font-mono text-ink">mobile</span>
          <span className="text-permission">Needs a permission</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="truncate font-mono text-small text-ink">pnpm install expo-haptics</span>
          <span className="ml-auto rounded-small bg-primary px-2 py-0.5 text-small text-primary-ink">Approve</span>
        </span>
      </div>
    </div>
  );
}

// A command line in the conversation: a press opens its output and a second press closes it.
function CommandOutputPiece() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="press flex w-full cursor-pointer items-center gap-2 rounded-small px-1.5 py-1 text-left text-small text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
      >
        <ArrowDownIcon size={13} className={`transition-[rotate] duration-200 ${open ? "rotate-0" : "-rotate-90"}`} />
        <span className="font-mono">git status --short</span>
        <span className="ml-auto text-ink-faint">{open ? "Hide" : "Show output"}</span>
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <pre className="overflow-hidden rounded-small bg-tray px-2.5 font-mono text-small leading-relaxed text-ink shadow-tray">
          <span className="block pt-1.5"> M src/auth/login.ts</span>
          <span className="block"> M src/auth/limits.ts</span>
          <span className="block pb-1.5">?? src/auth/login.test.ts</span>
        </pre>
      </div>
      {!open && <p className="px-1.5 text-small text-ink-faint">3 files changed since the last commit.</p>}
    </div>
  );
}

function CatchUpPiece() {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="ml-auto w-fit rounded-inner bg-raised px-2.5 py-1 text-small text-ink">catch me up</p>
      <div className="flex gap-2">
        <AssistantOrb state="speaking" size={20} label="The assistant, speaking" />
        <p className="text-small leading-relaxed text-ink">tests and docs finished, api is still working, and mobile needs you.</p>
      </div>
    </div>
  );
}

function QuietPiece() {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex items-center gap-2">
        <Face name="api" state="working" size={28} />
        <span className="font-mono text-meta text-ink">api</span>
        <span className="ml-auto font-mono text-small text-ink-faint tabular-nums">5:00</span>
      </span>
      <div className="flex gap-2">
        <AssistantOrb state="speaking" size={20} label="The assistant, speaking" />
        <p className="text-small leading-relaxed text-ink">api has gone quiet for 5 minutes. It may be stuck.</p>
      </div>
    </div>
  );
}

type Link = "connected" | "lost" | "back";

// What the page says when its connection drops and comes back, played on a press.
function RecoverPiece() {
  const [link, setLink] = useState<Link>("connected");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const drop = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setLink("lost");
    timers.current = [window.setTimeout(() => setLink("back"), 1400)];
  };
  const words: Record<Link, string> = {
    connected: "Connected",
    lost: "Lost the connection to HeyTerm. Reconnecting...",
    back: "Connected to HeyTerm again. Everything on the page is current.",
  };
  return (
    <div className="flex flex-col gap-3">
      <p key={link} className={`status-swap flex items-start gap-2 text-small ${link === "lost" ? "text-permission" : "text-ink"}`} aria-live="polite">
        {link === "lost" ? <span className="mt-1 size-2 shrink-0 rounded-full bg-permission" /> : <CheckIcon size={14} className="mt-0.5 shrink-0 text-finished" />}
        {words[link]}
      </p>
      <button
        type="button"
        onClick={drop}
        disabled={link === "lost"}
        className="press key-lift inline-flex h-7 w-fit cursor-pointer items-center rounded-small border border-line-strong bg-key px-2.5 text-small text-ink shadow-key hover:bg-key-hover disabled:cursor-default disabled:opacity-60"
      >
        Put the Mac to sleep
      </button>
    </div>
  );
}

// A session closes to Recently closed and comes back with its conversation.
function BringBackPiece() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small text-ink-faint">{open ? "Sessions" : "Recently closed"}</span>
      <div key={String(open)} className="status-swap flex items-center gap-2.5 rounded-inner bg-raised px-2.5 py-2">
        <Face name="docs" state={open ? "working" : undefined} size={28} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-meta text-ink">docs</span>
          <span className={`text-small ${open ? "text-working" : "text-ink-faint"}`}>{open ? "Working, where it left off" : "Closed when HeyTerm stopped"}</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="press key-lift inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-small border border-line-strong bg-key px-2.5 text-small text-ink shadow-key hover:bg-key-hover"
        >
          {open ? <CloseIcon size={13} /> : <BringBackIcon size={13} />}
          {open ? "Close" : "Bring back"}
        </button>
      </div>
    </div>
  );
}

function ThemePiece() {
  return (
    <div className="flex items-center gap-4">
      <div className="grid flex-1 grid-cols-[repeat(5,minmax(0,1fr))] gap-1.5" aria-hidden="true">
        {["bg-canvas", "bg-panel", "bg-raised", "bg-accent", "bg-terminal"].map((swatch) => (
          <span key={swatch} className={`h-14 rounded-small border border-line ${swatch}`} />
        ))}
      </div>
      <span className="flex flex-col items-center gap-1 text-small text-ink-faint">
        <ThemeToggle />
        Try it
      </span>
    </div>
  );
}

function PlatformsPiece() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {["macOS", "Linux", "Windows"].map((platform) => (
        <div key={platform} className="flex flex-col overflow-hidden rounded-small border border-line-strong bg-key">
          <span className="border-b border-line px-2 py-1 text-small text-ink-muted">{platform}</span>
          <span className="grid grid-cols-2 gap-1 p-1.5" aria-hidden="true">
            <span className="h-9 rounded-mark bg-terminal" />
            <span className="h-9 rounded-mark bg-terminal" />
          </span>
          <span className="px-2 pb-1.5 font-mono text-[10.5px] text-ink-faint">npx heyterm</span>
        </div>
      ))}
    </div>
  );
}

function UninstallPiece() {
  return (
    <div className="flex flex-col gap-0.5 overflow-hidden rounded-small bg-terminal px-3 py-2.5 font-mono text-small leading-relaxed text-terminal-ink">
      <p>
        <span className="text-terminal-ink/70">$</span> heyterm uninstall
      </p>
      <p className="truncate text-terminal-green">Took HeyTerm's hooks out of your Claude Code settings.</p>
      <p className="truncate text-terminal-green">Moved ~/.heyterm to the Trash.</p>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <span className="inline-grid h-6 min-w-6 place-items-center rounded-tiny border border-line-strong border-b-2 bg-key px-1.5 font-mono text-small text-ink">{children}</span>;
}

function ImageGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <circle cx={9} cy={9} r={2} />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  );
}
