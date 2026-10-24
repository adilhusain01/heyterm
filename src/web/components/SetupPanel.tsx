// Setup: what is installed, how voice gets in, where projects live, and whether the user's own
// Claude sessions are connected. Everything a new user needs on one screen.

import { useEffect, useState } from "react";
import { useCallsign } from "../app-context.tsx";
import { isPlayground } from "../playground/is-playground.ts";
import { useCallsignStore } from "../state/callsign-store.ts";
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
        {isPlayground ? <InstallSteps /> : setup ? <SetupSections setup={setup} /> : <p className="px-3 text-[13px] text-ink-muted">Checking this computer…</p>}
      </aside>
    </div>
  );
}

function InstallSteps() {
  return (
    <>
      <Section title="This is the playground">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          The three agents here are simulated, so you can try Callsign without installing anything. Speak with Wispr Flow (hold Fn) or type into the bar at the bottom. Try "catch me
          up", "approve", "after", "confirm", or "api, run the tests".
        </p>
      </Section>
      <Section title="Run it on your own sessions">
        <p className="text-[13px] text-ink-muted">You need macOS or Linux, Node.js 20+, tmux and Claude Code.</p>
        <pre className="overflow-x-auto rounded-inner border border-line bg-canvas px-2.5 py-2 font-mono text-[12px] leading-relaxed text-ink">
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
      <Section title="Tools">
        <CheckRow ok={setup.tmuxVersion !== undefined} label="tmux" value={setup.tmuxVersion ?? "Not installed"} fix={setup.tmuxVersion ? undefined : "brew install tmux (macOS) or sudo apt install tmux (Linux)"} />
        <CheckRow
          ok={setup.claudeVersionIsTested}
          label="Claude Code"
          value={setup.claudeVersion ?? "Not installed"}
          fix={!setup.claudeVersion ? "Install from code.claude.com" : setup.claudeVersionIsTested ? undefined : `Callsign was checked against ${setup.testedClaudeVersion}. Run claude update.`}
        />
        <CheckRow ok label="Node" value={setup.nodeVersion} />
      </Section>
      <VoiceSection />
      <ProjectFoldersSection setup={setup} />
      <ExistingSessionsSection connected={setup.existingSessionsConnected} />
      <Section title="Understanding what you say">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Common commands are understood on this computer at once. Anything else goes to <span className="font-mono text-ink">{setup.routerModel}</span>{" "}
          {setup.routerSource === "api" ? "through your Anthropic API key." : "through your own Claude Code login, so there is no key to set up."}
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
      <p className="text-[13px] leading-relaxed text-ink-muted">
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
          <p className="text-[12px] text-ink-faint">Mac voice uses the voice set in System Settings, Accessibility, Spoken Content. Siri voices work there and nowhere else.</p>
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
      <p className="text-[12px] text-ink-faint">Use headphones, so the spoken alerts never end up in your own dictation.</p>
    </Section>
  );
}

function ProjectFoldersSection({ setup }: { setup: SetupStatus }) {
  const { connection } = useCallsign();
  const [text, setText] = useState(setup.projectRoots.join("\n"));
  useEffect(() => setText(setup.projectRoots.join("\n")), [setup.projectRoots]);
  return (
    <Section title="Project folders">
      <p className="text-[13px] text-ink-muted">Folders that hold your git repositories, one per line. {setup.projectCount} {setup.projectCount === 1 ? "project" : "projects"} found.</p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        spellCheck={false}
        className="rounded-inner border border-line bg-canvas px-2.5 py-2 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-line-strong"
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
      <p className="text-[13px] leading-relaxed text-ink-muted">
        {connected
          ? "Connected. Sessions from any terminal show up here; Callsign answers their permissions and questions and tells you when they finish. It can't type into them."
          : "Connect to see the sessions you start in your own terminals too. Callsign adds its hooks to ~/.claude/settings.json, keeps a backup of the file first, and takes them out again when you disconnect."}
      </p>
      <div>
        <PanelButton onClick={() => connection.send({ type: "connect_existing_sessions", connected: !connected })}>{connected ? "Disconnect" : "Connect my sessions"}</PanelButton>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-outer border border-line bg-raised p-3">
      <h3 className="text-[13px] font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

function CheckRow({ ok, label, value, fix }: { ok: boolean; label: string; value: string; fix?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 text-[13px]">
        <span className={`size-2 rounded-mark ${ok ? "bg-finished" : "bg-permission"}`} />
        <span className="text-ink">{label}</span>
        <span className="ml-auto font-mono text-[12px] text-ink-muted">{value}</span>
      </div>
      {fix && <p className="pl-4 font-mono text-[12px] text-permission">{fix}</p>}
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
      className={`press h-8 cursor-pointer rounded-inner border px-3 text-[13px] ${selected ? "border-ink/60 bg-canvas text-ink" : "border-line bg-panel text-ink-muted shadow-press hover:border-line-strong hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function PanelButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="press h-8 cursor-pointer rounded-inner border border-line bg-panel px-3 text-[13px] text-ink shadow-press hover:border-line-strong">
      {children}
    </button>
  );
}
