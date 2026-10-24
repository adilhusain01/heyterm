// Setup: what is installed, how voice gets in, where projects live, and whether the user's own
// Claude sessions are connected. Everything a new user needs on one screen.

import { useEffect, useState } from "react";
import { useCallsign } from "../app-context.tsx";
import { isPlayground } from "../playground/is-playground.ts";
import { useCallsignStore } from "../state/callsign-store.ts";
import { Key } from "../ui/Key.tsx";
import { VoiceChoice } from "../voice/voice-choice.ts";
import { CloseIcon } from "./icons.tsx";
import type { SetupStatus } from "../../shared/protocol.ts";

export function SetupPanel({ onClose }: { onClose: () => void }) {
  const { connection } = useCallsign();
  const setup = useCallsignStore((state) => state.setup);

  useEffect(() => {
    connection.send({ type: "setup_refresh" });
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connection, onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-canvas/60" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-label="Setup"
        className="enter-rise flex h-full w-full max-w-[460px] flex-col gap-1 overflow-y-auto border-l border-line bg-panel p-1"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center px-3 pt-2.5 pb-1.5">
          <h2 className="text-[15px] font-medium text-ink">Setup</h2>
          <button type="button" aria-label="Close setup" onClick={onClose} className="press ml-auto flex size-8 cursor-pointer items-center justify-center rounded-inner text-ink-muted hover:bg-raised hover:text-ink">
            <CloseIcon />
          </button>
        </header>
        {isPlayground ? <InstallSteps /> : setup ? <SetupSections setup={setup} /> : <p className="px-3 text-meta text-ink-muted">Checking this computer…</p>}
      </aside>
    </div>
  );
}

function InstallSteps() {
  return (
    <>
      <Section title="This is the playground">
        <p className="text-meta leading-relaxed text-ink-muted">
          The three agents here are simulated, so you can try Callsign without installing anything. Speak with Wispr Flow (hold Fn) or type into the bar at the bottom. Try "catch me
          up", "approve", "after", "confirm", or "api, run the tests".
        </p>
      </Section>
      <Section title="Run it on your own sessions">
        <p className="text-meta text-ink-muted">You need macOS or Linux, Node.js 20+, tmux and Claude Code.</p>
        <pre className="overflow-x-auto rounded-inner border border-line bg-tray px-2.5 py-2 font-mono shadow-tray text-[12.5px] leading-relaxed text-ink">
          {["brew install tmux", "npx callsign-cli doctor", "npx callsign-cli"].join("\n")}
        </pre>
      </Section>
      <VoiceSection />
    </>
  );
}

function SetupSections({ setup }: { setup: SetupStatus }) {
  return (
    <>
      <Section title="Coding agents">
        {setup.agents.map((agent) => {
          const outdatedClaude = agent.kind === "claude" && agent.version && !setup.claudeVersionIsTested;
          const fix = !agent.version ? agent.installHint : outdatedClaude ? `Callsign was checked against ${setup.testedClaudeVersion}. Run claude update.` : undefined;
          return <CheckRow key={agent.kind} ok={Boolean(agent.version) && !outdatedClaude} label={agent.label} value={agent.version ?? "Not installed"} fix={fix} />;
        })}
        <CheckRow ok label="Node" value={setup.nodeVersion} />
      </Section>
      <VoiceSection />
      <ProjectFoldersSection setup={setup} />
      <ExistingSessionsSection connected={setup.existingSessionsConnected} />
      <RunningSection keepRunning={setup.keepRunningWithoutPage} />
      <Section title="The assistant">
        <p className="text-meta leading-relaxed text-ink-muted">
          Approvals, answers and commands that name a session happen on this computer at once. Everything else goes to the assistant, <span className="font-mono text-ink">{setup.routerModel}</span>,{" "}
          {setup.routerSource === "api" ? "through your Anthropic API key." : "through your own Claude Code login, so there is no key to set up."} It can run commands on this Mac; anything risky waits for you to say confirm.
        </p>
      </Section>
    </>
  );
}

function VoiceSection() {
  const { announcer } = useCallsign();
  const macVoiceAvailable = useCallsignStore((state) => state.setup?.macVoiceAvailable ?? false);
  const preference = useCallsignStore((state) => state.voicePreference);
  const setVoicePreference = useCallsignStore((state) => state.setVoicePreference);
  const voice = VoiceChoice.effective({ preference, macVoiceAvailable });
  const [notificationPermission, setNotificationPermission] = useState(() => ("Notification" in window ? Notification.permission : "denied"));
  return (
    <Section title="Voice">
      <p className="text-meta leading-relaxed text-ink-muted">
        Callsign reads whatever your dictation tool types into the bar at the bottom. With Wispr Flow, hold Fn and speak. macOS Dictation and plain typing work too.
      </p>
      {macVoiceAvailable && (
        <div className="flex flex-col gap-1.5">
          <div role="radiogroup" aria-label="Speaking voice" className="flex gap-1">
            <ChoiceButton selected={voice === "mac"} onClick={() => setVoicePreference("mac")}>
              Mac voice
            </ChoiceButton>
            <ChoiceButton selected={voice === "browser"} onClick={() => setVoicePreference("browser")}>
              Browser voice
            </ChoiceButton>
          </div>
          <p className="text-[12.5px] text-ink-faint">Mac voice uses the voice set in System Settings, Accessibility, Spoken Content. Siri voices work there and nowhere else.</p>
        </div>
      )}
      <div className="flex gap-1">
        <PanelButton
          onClick={() => {
            announcer.unlock();
            announcer.earcons.play("finished");
            announcer.speakNow("Callsign can talk to you.");
          }}
        >
          Test sound
        </PanelButton>
        {notificationPermission === "default" && (
          <PanelButton onClick={() => void Notification.requestPermission().then(setNotificationPermission)}>Allow notifications</PanelButton>
        )}
      </div>
      <p className="text-[12.5px] text-ink-faint">Use headphones, so the spoken alerts never end up in your own dictation.</p>
    </Section>
  );
}

function ProjectFoldersSection({ setup }: { setup: SetupStatus }) {
  const { connection } = useCallsign();
  const [text, setText] = useState(setup.projectRoots.join("\n"));
  useEffect(() => setText(setup.projectRoots.join("\n")), [setup.projectRoots]);
  return (
    <Section title="Project folders">
      <p className="text-meta text-ink-muted">Folders that hold your git repositories, one per line. {setup.projectCount} {setup.projectCount === 1 ? "project" : "projects"} found.</p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        spellCheck={false}
        className="rounded-inner border border-line bg-tray px-2.5 py-2 font-mono shadow-tray text-[12.5px] leading-relaxed text-ink outline-none focus:border-line-strong"
      />
      <div>
        <PanelButton onClick={() => connection.send({ type: "set_project_roots", roots: text.split("\n") })}>Save folders</PanelButton>
      </div>
    </Section>
  );
}

function ExistingSessionsSection({ connected }: { connected: boolean }) {
  const { connection } = useCallsign();
  return (
    <Section title="Claude sessions you start yourself">
      <p className="text-meta leading-relaxed text-ink-muted">
        {connected
          ? "On. Claude sessions from any terminal show up here; Callsign answers their permissions and questions and tells you when they finish. It can't type into them. Its hooks are in ~/.claude/settings.json only while Callsign runs."
          : "Turn on to see the Claude sessions you start in your own terminals too. While Callsign runs, its hooks sit in ~/.claude/settings.json (backed up first); they come out when it stops or when you turn this off."}
      </p>
      <div>
        <PanelButton onClick={() => connection.send({ type: "connect_existing_sessions", connected: !connected })}>{connected ? "Turn off" : "Show my own sessions"}</PanelButton>
      </div>
    </Section>
  );
}

function RunningSection({ keepRunning }: { keepRunning: boolean }) {
  const { connection } = useCallsign();
  return (
    <Section title="Closing Callsign">
      <p className="text-meta leading-relaxed text-ink-muted">
        {keepRunning
          ? "Callsign keeps running when you close this page. Stop it with Quit, or callsign stop in a terminal."
          : "Closing the last Callsign page closes Callsign and every session in it after 15 seconds. Sessions come back from Recently closed."}
      </p>
      <div className="flex gap-1">
        <PanelButton onClick={() => connection.send({ type: "set_keep_running", keepRunning: !keepRunning })}>{keepRunning ? "Close with the page" : "Keep running without the page"}</PanelButton>
        <PanelButton onClick={() => connection.send({ type: "quit" })}>Quit Callsign</PanelButton>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-outer border border-line bg-raised p-3">
      <h3 className="text-meta font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

function CheckRow({ ok, label, value, fix }: { ok: boolean; label: string; value: string; fix?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 text-meta">
        <span className={`size-2 rounded-mark ${ok ? "bg-finished" : "bg-permission"}`} />
        <span className="text-ink">{label}</span>
        <span className="ml-auto font-mono text-[12.5px] text-ink-muted">{value}</span>
      </div>
      {fix && <p className="pl-4 font-mono text-[12.5px] text-permission">{fix}</p>}
    </div>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`press h-8 cursor-pointer rounded-inner border px-3 text-meta font-medium ${selected ? "border-line bg-key text-ink shadow-key ring-1 ring-ink/50" : "key-lift border-line bg-key text-ink-muted shadow-key hover:bg-key-hover hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function PanelButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <Key onClick={onClick}>{children}</Key>;
}
