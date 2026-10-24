import { describe, expect, it } from "vitest";
import { SessionResume } from "./session-resume.ts";

describe("SessionResume.claudeArguments", () => {
  it("resumes the conversation when Claude saved it", () => {
    expect(SessionResume.claudeArguments({ claudeSessionId: "abc", transcriptPath: "/t/abc.jsonl" }, { transcriptExists: true })).toBe("--resume abc");
  });

  it("starts a fresh Claude when the session never got a message, because Claude saved nothing to resume", () => {
    expect(SessionResume.claudeArguments({ claudeSessionId: "abc", transcriptPath: "/t/abc.jsonl" }, { transcriptExists: false })).toBe("");
  });

  it("goes by whether a prompt was ever sent when the transcript path is unknown", () => {
    expect(SessionResume.claudeArguments({ claudeSessionId: "abc" }, { transcriptExists: undefined })).toBe("");
    expect(SessionResume.claudeArguments({ claudeSessionId: "abc", lastPrompt: "fix the header" }, { transcriptExists: undefined })).toBe("--resume abc");
  });

  it("never falls back to --continue, which could pick up a different conversation in the folder", () => {
    expect(SessionResume.claudeArguments({ lastPrompt: "fix the header" }, { transcriptExists: undefined })).toBe("");
  });
});

describe("SessionResume.endedOnItsOwn", () => {
  const now = 100_000;
  it("is true for a session whose terminal is gone", () => {
    expect(SessionResume.endedOnItsOwn({ state: "idle", stateSince: 0 }, { terminalRunning: false, now })).toBe(true);
  });

  it("leaves a running terminal alone", () => {
    expect(SessionResume.endedOnItsOwn({ state: "stopped", stateSince: 0 }, { terminalRunning: true, now })).toBe(false);
  });

  it("gives a session that is still starting a few seconds for its terminal to appear", () => {
    expect(SessionResume.endedOnItsOwn({ state: "starting", stateSince: now - 1_000 }, { terminalRunning: false, now })).toBe(false);
    expect(SessionResume.endedOnItsOwn({ state: "starting", stateSince: now - 30_000 }, { terminalRunning: false, now })).toBe(true);
  });

  it("leaves sessions from the user's own terminals to their own hooks", () => {
    expect(SessionResume.endedOnItsOwn({ state: "idle", stateSince: 0, origin: "external" }, { terminalRunning: false, now })).toBe(false);
  });
});
