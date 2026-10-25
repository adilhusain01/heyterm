// Everything the UI shows, kept in step with the server's snapshots.

import { create } from "zustand";
import { HandsOffTally, type ActionSource } from "./hands-off-tally.ts";
import type { SessionDigest } from "../../shared/catch-up.ts";
import type { ClosedSessionView, ControlState, ConversationEntry, ServerMessage, SetupStatus } from "../../shared/protocol.ts";
import type { SessionView } from "../../shared/types.ts";
import type { ConnectionStatus } from "../transport/connection.ts";
import { VoiceChoice, type Voice } from "../voice/voice-choice.ts";
import type { Listening } from "../listening-state.ts";
import { loadLayoutPreferences, saveLayoutPreferences, type LayoutPreferences } from "./layout-preferences.ts";

interface HeyTermState {
  connectionStatus: ConnectionStatus;
  hasSnapshot: boolean;
  sessions: SessionView[];
  recentlyClosed: ClosedSessionView[];
  projects: string[];
  control: ControlState;
  // Server time minus this browser's time, so wait timers match the server's clock.
  serverClockOffset: number;
  focusedSession: string | undefined;
  // The terminal pane the user is typing into by hand, if any. The command bar steps back while one is.
  typingSession: string | undefined;
  catchUp: SessionDigest[] | undefined;
  setup: SetupStatus | undefined;
  conversation: ConversationEntry[];
  // HeyTerm is talking right now.
  speaking: boolean;
  // Whether dictation would reach the bar, and whether words are in it now.
  listening: Listening;
  barHasText: boolean;
  layout: LayoutPreferences;
  handsOff: HandsOffTally;
  // The voice the user picked in Setup; undefined means the default for this computer.
  voicePreference: Voice | undefined;

  applyServerMessage: (message: ServerMessage) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setTypingSession: (sessionName: string | undefined) => void;
  closeCatchUp: () => void;
  recordAction: (source: ActionSource) => void;
  setVoicePreference: (voice: Voice) => void;
  setSpeaking: (speaking: boolean) => void;
  setBarState: (barState: { listening?: Listening; barHasText?: boolean }) => void;
  changeLayout: (change: Partial<LayoutPreferences>) => void;
}

export const useHeyTermStore = create<HeyTermState>((set) => ({
  connectionStatus: "connecting",
  hasSnapshot: false,
  sessions: [],
  recentlyClosed: [],
  projects: [],
  control: { mode: "speak", routing: false },
  serverClockOffset: 0,
  focusedSession: undefined,
  typingSession: undefined,
  catchUp: undefined,
  setup: undefined,
  conversation: [],
  speaking: false,
  listening: "listening",
  barHasText: false,
  layout: loadLayoutPreferences(),
  handsOff: HandsOffTally.loadToday(),
  voicePreference: VoiceChoice.savedPreference(),

  applyServerMessage: (message) => {
    if (message.type === "snapshot") {
      set({
        hasSnapshot: true,
        sessions: message.sessions,
        recentlyClosed: message.recentlyClosed,
        projects: message.projects,
        control: message.control,
        focusedSession: message.control.focusedSession,
        serverClockOffset: message.serverTime - Date.now(),
      });
    }
    if (message.type === "focus") set({ focusedSession: message.session });
    if (message.type === "catch_up") set({ catchUp: message.digests });
    if (message.type === "setup") set({ setup: message.setup });
    if (message.type === "conversation") set({ conversation: message.entries });
  },
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setTypingSession: (typingSession) => set({ typingSession }),
  closeCatchUp: () => set({ catchUp: undefined }),
  recordAction: (source) => set((state) => ({ handsOff: state.handsOff.withAction(source) })),
  setSpeaking: (speaking) => set({ speaking }),
  setBarState: (barState) => set(barState),
  changeLayout: (change) =>
    set((state) => {
      const layout = { ...state.layout, ...change };
      saveLayoutPreferences(layout);
      return { layout };
    }),
  setVoicePreference: (voicePreference) => {
    VoiceChoice.savePreference(voicePreference);
    set({ voicePreference });
  },
}));
