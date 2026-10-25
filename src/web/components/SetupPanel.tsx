// Setup: what is installed, how voice gets in, where projects live, and whether the user's own
// Claude sessions are connected. Everything a new user needs on one screen.

import { useEffect, useState } from "react";
import { useHeyTerm } from "../app-context.tsx";
import { isPlayground } from "../playground/is-playground.ts";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { HelpTip, SayThis } from "../ui/HelpTip.tsx";
import { Key } from "../ui/Key.tsx";
import { VoiceChoice } from "../voice/voice-choice.ts";
import { CloseIcon, MoonIcon, SunIcon } from "../ui/icons.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import type { SetupStatus } from "../../shared/protocol.ts";

export function SetupPanel({ onClose }: { onClose: () => void }) {
  const { connection } = useHeyTerm();
  const setup = useHeyTermStore((state) => state.setup);

  useEffect(() => {
    connection.send({ type: "setup_refresh" });
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connection, onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-scrim" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-label="Setup"
        className="enter-rise flex h-full w-full max-w-[460px] flex-col gap-1 overflow-y-auto border-l border-line bg-panel p-1"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center px-3 pt-2.5 pb-1.5">
          <h2 className="text-body font-medium text-ink">Setup</h2>
          <button type="button" aria-label="Close setup" onClick={onClose} className="press ml-auto flex size-8 cursor-pointer items-center justify-center rounded-inner text-ink-muted hover:bg-raised hover:text-ink">
            <CloseIcon />
          </button>
        </header>
        <AppearanceSection />
        {isPlayground ? <InstallSteps /> : setup ? <SetupSections setup={setup} /> : <p className="px-3 text-meta text-ink-muted">Checking this computer…</p>}
      </aside>
    </div>
  );
}

function AppearanceSection() {
  const theme = useHeyTermStore((state) => state.layout.theme);
  const changeLayout = useHeyTermStore((state) => state.changeLayout);
  return (
    <Section title="Appearance">
      <Segmented
        label="Theme"
        value={theme}
        onChange={(value) => changeLayout({ theme: value })}
        options={[
          { value: "light", label: "Light", icon: <SunIcon size={14} /> },
          { value: "dark", label: "Dark", icon: <MoonIcon size={14} /> },
          { value: "system", label: "System" },
        ]}
      />
    </Section>
  );
}

function InstallSteps() {
  return (
    <>
      <Section title="This is the playground">
        <p className="text-meta leading-relaxed text-ink-muted">
          The three agents here are simulated, so you can try HeyTerm without installing anything. Speak with Wispr Flow (hold Fn) or type into the bar. Try <SayThis>catch me up</SayThis>,{" "}
          <SayThis>approve</SayThis> or <SayThis>api, run the tests</SayThis>.
        </p>
      </Section>
      <Section
        title="Run it on your own sessions"
        help={
          <>
            <span>Works on macOS, Linux and Windows with Node.js 20 or newer.</span>
            <span>Install at least one agent: Claude Code, Codex (npm install -g @openai/codex), Gemini CLI (npm install -g @google/gemini-cli), Grok Build or Cursor. The assistant uses your Claude login.</span>
          </>
        }
      >
        <pre className="overflow-x-auto rounded-inner border border-line bg-tray px-2.5 py-2 font-mono text-small leading-relaxed text-ink shadow-tray">{["npx heyterm doctor", "npx heyterm"].join("\n")}</pre>
        <a href="https://github.com/adilhusain01/heyterm" target="_blank" rel="noopener noreferrer" className="text-meta text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink">
          Source and docs on GitHub
        </a>
      </Section>
      <VoiceSection />
    </>
  );
}

function SetupSections({ setup }: { setup: SetupStatus }) {
  return (
    <>
      <Section
        title="Coding agents"
        help={
          <>
            <span>The agents HeyTerm can run. Install any of them; the assistant in the middle needs Claude Code.</span>
            <span>Say <SayThis>start a codex session in api</SayThis> to pick one by voice.</span>
          </>
        }
      >
        {setup.agents.map((agent) => {
          const outdatedClaude = agent.kind === "claude" && agent.version && !setup.claudeVersionIsTested;
          const fix = !agent.version ? agent.installHint : outdatedClaude ? `HeyTerm was checked against ${setup.testedClaudeVersion}. Run claude update.` : undefined;
          return <CheckRow key={agent.kind} ok={Boolean(agent.version) && !outdatedClaude} label={agent.label} value={agent.version ?? "Not installed"} fix={fix} />;
        })}
        <CheckRow ok label="Node" value={setup.nodeVersion} />
      </Section>
      <VoiceSection />
      <ProjectFoldersSection setup={setup} />
      <ExistingSessionsSection connected={setup.existingSessionsConnected} />
      <RunningSection keepRunning={setup.keepRunningWithoutPage} />
      <Section
        title="The assistant"
        help={
          <>
            <span>Approvals, answers and commands that name a session happen at once. Everything else goes to the assistant, which reads sessions, sends them work and runs commands.</span>
            <span>It does what your Claude Code permission mode allows, and asks you out loud whenever Claude Code would ask.</span>
          </>
        }
      >
        <p className="text-meta text-ink-muted">
          <span className="font-mono text-ink">{setup.routerModel}</span> on {setup.routerSource === "api" ? "your API key" : "your Claude Code login"}
        </p>
      </Section>
    </>
  );
}

function VoiceSection() {
  const { announcer } = useHeyTerm();
  const macVoiceAvailable = useHeyTermStore((state) => state.setup?.macVoiceAvailable ?? false);
  const preference = useHeyTermStore((state) => state.voicePreference);
  const setVoicePreference = useHeyTermStore((state) => state.setVoicePreference);
  const voice = VoiceChoice.effective({ preference, macVoiceAvailable });
  const [notificationPermission, setNotificationPermission] = useState(() => ("Notification" in window ? Notification.permission : "denied"));
  return (
    <Section
      title="Voice"
      help={
        <>
          <span>HeyTerm reads whatever your dictation tool types into the bar at the bottom. With Wispr Flow, hold Fn and speak; macOS Dictation and typing work too.</span>
          <span>Mac voice speaks with the voice set in System Settings, Accessibility, Spoken Content, Siri voices included. Browsers cannot use those.</span>
          <span>Use headphones, so spoken alerts never end up in your dictation.</span>
        </>
      }
    >
      {macVoiceAvailable && (
        <Segmented
          label="Speaking voice"
          value={voice}
          onChange={(value) => setVoicePreference(value)}
          options={[
            { value: "mac", label: "Mac voice" },
            { value: "browser", label: "Browser voice" },
          ]}
        />
      )}
      <div className="flex gap-1">
        <PanelButton
          onClick={() => {
            announcer.unlock();
            announcer.earcons.play("finished");
            announcer.speakNow("HeyTerm can talk to you.");
          }}
        >
          Test sound
        </PanelButton>
        {notificationPermission === "default" && (
          <PanelButton onClick={() => void Notification.requestPermission().then(setNotificationPermission)}>Allow notifications</PanelButton>
        )}
      </div>
    </Section>
  );
}

function ProjectFoldersSection({ setup }: { setup: SetupStatus }) {
  const { connection } = useHeyTerm();
  const [text, setText] = useState(setup.projectRoots.join("\n"));
  useEffect(() => setText(setup.projectRoots.join("\n")), [setup.projectRoots]);
  return (
    <Section
      title="Project folders"
      help={
        <>
          <span>Folders that hold your git repositories, one per line. HeyTerm looks three levels down for projects to name by voice.</span>
          <span>The assistant can still start a session in any folder you name: <SayThis>open a session in ~/Downloads</SayThis>.</span>
        </>
      }
    >
      <p className="text-meta text-ink-muted">
        {setup.projectCount} {setup.projectCount === 1 ? "project" : "projects"} found
      </p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        spellCheck={false}
        className="rounded-inner border border-line bg-tray px-2.5 py-2 font-mono shadow-tray text-small leading-relaxed text-ink outline-none focus:border-line-strong"
      />
      <div>
        <PanelButton onClick={() => connection.send({ type: "set_project_roots", roots: text.split("\n") })}>Save folders</PanelButton>
      </div>
    </Section>
  );
}

function ExistingSessionsSection({ connected }: { connected: boolean }) {
  const { connection } = useHeyTerm();
  return (
    <Section
      title="Your own Claude sessions"
      help={
        <>
          <span>Claude sessions you start in your own terminals show up too. HeyTerm answers their permissions and questions and tells you when they finish, but cannot type into them.</span>
          <span>While HeyTerm runs, its hooks sit in ~/.claude/settings.json (backed up first). They come out when it stops or when you turn this off.</span>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-meta text-ink-muted">{connected ? "Shown" : "Hidden"}</span>
        <span className="ml-auto">
          <PanelButton onClick={() => connection.send({ type: "connect_existing_sessions", connected: !connected })}>{connected ? "Hide them" : "Show them"}</PanelButton>
        </span>
      </div>
    </Section>
  );
}

function RunningSection({ keepRunning }: { keepRunning: boolean }) {
  const { connection } = useHeyTerm();
  return (
    <Section
      title="Closing HeyTerm"
      help={
        <>
          <span>By default, closing the last HeyTerm page closes HeyTerm and every session in it after 15 seconds, so a reload never does. Sessions come back from Recently closed.</span>
          <span>You can also stop it with heyterm stop in a terminal, and remove it with heyterm uninstall.</span>
        </>
      }
    >
      <p className="text-meta text-ink-muted">{keepRunning ? "Keeps running when the page closes" : "Closes with the page"}</p>
      <div className="flex gap-1">
        <PanelButton onClick={() => connection.send({ type: "set_keep_running", keepRunning: !keepRunning })}>{keepRunning ? "Close with the page" : "Keep running without the page"}</PanelButton>
        <PanelButton onClick={() => connection.send({ type: "quit" })}>Quit HeyTerm</PanelButton>
      </div>
    </Section>
  );
}

function Section({ title, help, children }: { title: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-outer border border-line bg-raised p-3">
      <div className="flex items-center gap-1">
        <h3 className="text-meta font-medium text-ink">{title}</h3>
        {help && <HelpTip title={title}>{help}</HelpTip>}
      </div>
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
        <span className="ml-auto font-mono text-small text-ink-muted">{value}</span>
      </div>
      {fix && <p className="pl-4 font-mono text-small text-permission">{fix}</p>}
    </div>
  );
}

function PanelButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <Key onClick={onClick}>{children}</Key>;
}
