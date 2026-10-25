// Messages between the HeyTerm server and the web UI over /ws.

import type { SessionDigest } from "./catch-up.ts";
import type { AgentKind, AnnouncementMode, AttentionKind, RouterAction, SessionOrigin, SessionView } from "./types.ts";

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
  // True while the assistant is working on something the user said or something that happened.
  routing: boolean;
  lastHeard?: string;
}

export interface ClosedSessionView {
  name: string;
  projectName: string;
  // Enough to tell closed sessions apart in the sidebar's details card.
  agent?: AgentKind;
  projectPath?: string;
  origin?: SessionOrigin;
  agentSessionId?: string;
  createdAt?: number;
  closedAt?: number;
}

// What the Setup screen shows: what is installed, which folders hold projects, what is connected.
export interface AgentStatus {
  kind: AgentKind;
  label: string;
  version?: string;
  installHint: string;
}

export interface SetupStatus {
  // Every coding agent HeyTerm can run, with its version when it is installed.
  agents: AgentStatus[];
  claudeVersion?: string;
  // The Claude Code release HeyTerm was last checked against; older ones may lack a hook it needs.
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
  keepRunningWithoutPage: boolean;
}

export type ConversationEntryKind = "user" | "assistant" | "tool" | "event" | "request" | "error";

// Which session request a "request" line is about; it stays answerable while that request waits.
export interface ConversationRequest {
  session: string;
  kind: AttentionKind;
  since: number;
}

// One line of the conversation with the assistant: what the user said, what it replied, the
// commands and session actions it took, and what happened in the sessions.
export interface ConversationEntry {
  id: number;
  at: number;
  kind: ConversationEntryKind;
  text: string;
  request?: ConversationRequest;
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
  | { type: "setup"; setup: SetupStatus }
  | { type: "conversation"; entries: ConversationEntry[] }
  // A line the assistant says out loud.
  | { type: "say"; text: string }
  // The Mac finished saying a line this page asked for.
  | { type: "speech_done"; id: number };

export type InputSource = "voice" | "keyboard";

export type ClientMessage =
  | { type: "utterance"; text: string; source: InputSource }
  | { type: "action"; action: RouterAction }
  | { type: "focus"; session: string }
  | { type: "setup_refresh" }
  | { type: "set_project_roots"; roots: string[] }
  | { type: "connect_existing_sessions"; connected: boolean }
  | { type: "set_keep_running"; keepRunning: boolean }
  // How text reached the page (kinds and lengths, never words), for when dictation seems lost.
  | { type: "input_diagnostics"; records: Array<Record<string, unknown>> }
  // Stop HeyTerm and every session in it.
  | { type: "quit" }
  | { type: "speak"; text: string; id: number }
  | { type: "stop_speaking" };
