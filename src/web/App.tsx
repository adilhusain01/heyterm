// The window: top bar, the rail of what needs you, the terminals, and the command bar.

import { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { CallsignProvider } from "./app-context.tsx";
import { CatchUpPanel } from "./components/CatchUpPanel.tsx";
import { CommandBar } from "./components/CommandBar.tsx";
import { ConversationPanel } from "./components/ConversationPanel.tsx";
import { SessionRail } from "./components/SessionRail.tsx";
import { SetupPanel } from "./components/SetupPanel.tsx";
import { TerminalGrid } from "./components/TerminalGrid.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { WelcomeState } from "./components/WelcomeState.tsx";
import { isPlayground } from "./playground/is-playground.ts";
import { useCallsignStore } from "./state/callsign-store.ts";
import type { CallsignConnection } from "./transport/connection.ts";
import { VoiceChoice } from "./voice/voice-choice.ts";
import type { Announcer } from "./voice/announcer.ts";
import type { ServerMessage } from "../shared/protocol.ts";
import type { AttentionItem } from "../shared/types.ts";

export function App({ connection, announcer }: { connection: CallsignConnection; announcer: Announcer }) {
  const hasSnapshot = useCallsignStore((state) => state.hasSnapshot);
  const sessionCount = useCallsignStore((state) => state.sessions.length);
  const setup = useCallsignStore((state) => state.setup);
  const [isSetupOpen, setSetupOpen] = useState(false);
  const closeSetup = useCallback(() => setSetupOpen(false), []);

  useServerMessages(connection, announcer);
  useChosenVoice(connection, announcer);
  const setSpeaking = useCallsignStore((state) => state.setSpeaking);
  useEffect(() => {
    announcer.onSpeakingChange = setSpeaking;
  }, [announcer, setSpeaking]);
  useUnlockSoundOnFirstGesture(announcer);

  // A new user missing tmux or Claude Code sees what to install before anything else.
  const isMissingTools = setup !== undefined && (!setup.tmuxVersion || !setup.claudeVersion);
  useEffect(() => {
    if (isMissingTools) setSetupOpen(true);
  }, [isMissingTools]);

  return (
    <CallsignProvider connection={connection} announcer={announcer}>
      <div className="flex h-full flex-col">
        <TopBar onOpenSetup={() => setSetupOpen(true)} />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <SessionRail />
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <CatchUpPanel />
            {hasSnapshot && sessionCount === 0 ? <WelcomeState onOpenSetup={() => setSetupOpen(true)} /> : <TerminalGrid />}
          </main>
          {!isPlayground && <ConversationPanel />}
        </div>
        <CommandBar />
      </div>
      {isSetupOpen && <SetupPanel onClose={closeSetup} />}
      <Toaster theme="dark" position="bottom-right" offset={{ bottom: 96, right: 16 }} toastOptions={{ style: { borderRadius: 6 } }} />
    </CallsignProvider>
  );
}

function useServerMessages(connection: CallsignConnection, announcer: Announcer) {
  const applyServerMessage = useCallsignStore((state) => state.applyServerMessage);
  const setConnectionStatus = useCallsignStore((state) => state.setConnectionStatus);
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
function useChosenVoice(connection: CallsignConnection, announcer: Announcer) {
  const macVoiceAvailable = useCallsignStore((state) => state.setup?.macVoiceAvailable ?? false);
  const preference = useCallsignStore((state) => state.voicePreference);
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
  for (const item of arrived) new Notification("Callsign", { body: item.headline, tag: `${item.sessionName}-${item.kind}` });
}

function updateTitle(waitingCount: number): void {
  document.title = waitingCount > 0 ? `(${waitingCount}) Callsign` : "Callsign";
}
