// Messages between the Callsign server and the web UI over /ws.

import type { SessionDigest } from "./catch-up.ts";
import type { AnnouncementMode, RouterAction, SessionView } from "./types.ts";

export interface Feedback {
  text: string;
  tone: "info" | "success" | "warning" | "error";
  speak: boolean;
}

export interface PreviewView {
  session: string;
  text: string;
  deadline: number;
}

export interface ClarifyView {
  question: string;
  options: string[];
}

export interface ControlState {
  preview?: PreviewView;
  clarify?: ClarifyView;
  // What a spoken "confirm" would do right now.
  confirmation?: string;
  mode: AnnouncementMode;
  focusedSession?: string;
  // True while the model router is thinking about an utterance.
  routing: boolean;
  lastHeard?: string;
}

export interface ClosedSessionView {
  name: string;
  projectName: string;
}

// What the Setup screen shows: what is installed, which folders hold projects, what is connected.
export interface SetupStatus {
  tmuxVersion?: string;
  claudeVersion?: string;
  // The Claude Code release Callsign was last checked against; older ones may lack a hook it needs.
  testedClaudeVersion: string;
  claudeVersionIsTested: boolean;
  nodeVersion: string;
  projectRoots: string[];
  projectCount: number;
  existingSessionsConnected: boolean;
  routerSource: "api" | "claude-code";
  routerModel: string;
  // The server runs on a Mac and can speak with the system voice.
  macVoiceAvailable: boolean;
}

export type ServerMessage =
  | {
      type: "snapshot";
      sessions: SessionView[];
      recentlyClosed: ClosedSessionView[];
      projects: string[];
      control: ControlState;
      serverTime: number;
    }
  | { type: "feedback"; feedback: Feedback }
  | { type: "focus"; session: string }
  | { type: "catch_up"; digests: SessionDigest[] }
  | { type: "setup"; setup: SetupStatus };

export type InputSource = "voice" | "keyboard";

export type ClientMessage =
  | { type: "utterance"; text: string; source: InputSource }
  | { type: "action"; action: RouterAction }
  | { type: "focus"; session: string }
  | { type: "setup_refresh" }
  | { type: "set_project_roots"; roots: string[] }
  | { type: "connect_existing_sessions"; connected: boolean }
  | { type: "speak"; text: string }
  | { type: "stop_speaking" };
