// The window: top bar, the rail of what needs you, the terminals, and the command bar.

import { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { HeyTermProvider } from "./app-context.tsx";
import { CatchUpPanel } from "./components/CatchUpPanel.tsx";
import { CommandBar } from "./components/CommandBar.tsx";
import { ConversationPanel } from "./components/ConversationPanel.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { SetupPanel } from "./components/SetupPanel.tsx";
import { TerminalGrid } from "./components/TerminalGrid.tsx";
import { WelcomeState } from "./components/WelcomeState.tsx";
import { isPlayground } from "./playground/is-playground.ts";
import { useHeyTermStore } from "./state/heyterm-store.ts";
import { useAppliedTheme } from "./state/use-applied-theme.ts";
import type { HeyTermConnection } from "./transport/connection.ts";
import { VoiceChoice } from "./voice/voice-choice.ts";
import type { Announcer } from "./voice/announcer.ts";
import type { ServerMessage } from "../shared/protocol.ts";
import type { AttentionItem } from "../shared/types.ts";

export function App({ connection, announcer }: { connection: HeyTermConnection; announcer: Announcer }) {
  const hasSnapshot = useHeyTermStore((state) => state.hasSnapshot);
  const sessionCount = useHeyTermStore((state) => state.sessions.length);
  const setup = useHeyTermStore((state) => state.setup);
  const [isSetupOpen, setSetupOpen] = useState(false);
  const closeSetup = useCallback(() => setSetupOpen(false), []);

  const theme = useAppliedTheme();
  useServerMessages(connection, announcer);
  useChosenVoice(connection, announcer);
  const setSpeaking = useHeyTermStore((state) => state.setSpeaking);
  useEffect(() => {
    announcer.onSpeakingChange = setSpeaking;
  }, [announcer, setSpeaking]);
  useUnlockSoundOnFirstGesture(announcer);

  // A new user with no coding agent installed sees what to install before anything else.
  const isMissingTools = setup !== undefined && setup.agents.every((agent) => !agent.version);
  useEffect(() => {
    if (isMissingTools) setSetupOpen(true);
  }, [isMissingTools]);

  return (
    <HeyTermProvider connection={connection} announcer={announcer}>
      <div className="flex h-full flex-col md:flex-row">
        <Sidebar onOpenSetup={() => setSetupOpen(true)} />
        <div className="flex min-h-[55vh] min-w-0 flex-1 flex-col md:min-h-0">
          <div className="flex min-h-0 flex-1">
            {/* The bar belongs to the terminals: it sits under them, as wide as they are. */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                <CatchUpPanel />
                {hasSnapshot && sessionCount === 0 ? <WelcomeState onOpenSetup={() => setSetupOpen(true)} /> : <TerminalGrid />}
              </main>
              <CommandBar />
            </div>
            {!isPlayground && <ConversationPanel />}
          </div>
        </div>
      </div>
      {isSetupOpen && <SetupPanel onClose={closeSetup} />}
      <Toaster
        theme={theme}
        position="bottom-right"
        offset={{ bottom: 96, right: 16 }}
        toastOptions={{
          style: {
            borderRadius: "var(--radius-inner)",
            background: "var(--color-canvas)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-line-strong)",
            boxShadow: "none",
            fontFamily: "var(--font-sans)",
          },
        }}
      />
    </HeyTermProvider>
  );
}

function useServerMessages(connection: HeyTermConnection, announcer: Announcer) {
  const applyServerMessage = useHeyTermStore((state) => state.applyServerMessage);
  const setConnectionStatus = useHeyTermStore((state) => state.setConnectionStatus);
  useEffect(() => {
    return connection.connect({
      onStatus: setConnectionStatus,
      onMessage: (message: ServerMessage) => {
        applyServerMessage(message);
        if (message.type === "snapshot") {
          announcer.mode = message.control.mode;
          const arrived = announcer.noteSessions(message.sessions);
          notifyWhenHidden(arrived);
          updateTitle(message.sessions.filter((session) => ["needs_permission", "asked", "needs_trust", "failed"].includes(session.state)).length);
        }
        if (message.type === "say") announcer.sayWhenQuiet(message.text);
        if (message.type === "speech_done") announcer.noteMacLineDone(message.id);
        if (message.type === "feedback") {
          announcer.noteFeedback(message.feedback);
          const show = message.feedback.tone === "error" ? toast.error : message.feedback.tone === "warning" ? toast.warning : message.feedback.tone === "success" ? toast.success : toast;
          show(message.feedback.text);
        }
      },
    });
  }, [connection, announcer, applyServerMessage, setConnectionStatus]);
}

// Points the announcer at the Mac's voice or the browser's, following Setup.
function useChosenVoice(connection: HeyTermConnection, announcer: Announcer) {
  const macVoiceAvailable = useHeyTermStore((state) => state.setup?.macVoiceAvailable ?? false);
  const preference = useHeyTermStore((state) => state.voicePreference);
  useEffect(() => {
    const voice = VoiceChoice.effective({ preference, macVoiceAvailable });
    const macSpeaker = {
      speak: (text: string, id: number) => connection.send({ type: "speak", text, id }),
      stop: () => connection.send({ type: "stop_speaking" }),
    };
    announcer.useVoice(voice, voice === "mac" ? macSpeaker : undefined);
  }, [connection, announcer, preference, macVoiceAvailable]);
}

// Browsers keep a page silent until the user clicks or presses a key on it once.
function useUnlockSoundOnFirstGesture(announcer: Announcer) {
  useEffect(() => {
    const unlock = () => announcer.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [announcer]);
}

function notifyWhenHidden(arrived: AttentionItem[]): void {
  if (!document.hidden || arrived.length === 0 || !("Notification" in window) || Notification.permission !== "granted") return;
  for (const item of arrived) new Notification("HeyTerm", { body: item.headline, tag: `${item.sessionName}-${item.kind}` });
}

function updateTitle(waitingCount: number): void {
  document.title = waitingCount > 0 ? `(${waitingCount}) HeyTerm` : "HeyTerm";
}
