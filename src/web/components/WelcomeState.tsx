// What a new user sees before any session exists: what to say, and projects to click instead.

import { useCallsign } from "../app-context.tsx";
import { useCallsignStore } from "../state/callsign-store.ts";

export function WelcomeState({ onOpenSetup }: { onOpenSetup: () => void }) {
  const { perform } = useCallsign();
  const projects = useCallsignStore((state) => state.projects);
  const exampleProject = projects[0] ?? "your-project";
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="flex w-full max-w-[520px] flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-[22px] font-medium tracking-tight text-ink">Run your coding agents by voice</h1>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            Start several Claude Code sessions, then talk. Callsign sends your words to the right one, tells you when one needs you, and lets you approve or answer without
            touching the keyboard.
          </p>
        </div>
        <div className="rounded-outer border border-line bg-panel p-1">
          <p className="px-3 pt-2.5 pb-2 text-[13px] text-ink-muted">Hold your dictation key and say:</p>
          <p className="rounded-inner bg-raised px-3 py-2.5 font-mono text-[14px] text-ink">start a session in {exampleProject} and explain how it is laid out</p>
        </div>
        {projects.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-muted">Or pick a project:</p>
            <div className="flex flex-wrap gap-1">
              {projects.slice(0, 10).map((project) => (
                <button
                  key={project}
                  type="button"
                  onClick={() => perform({ type: "spawn", project })}
                  className="press h-8 cursor-pointer rounded-inner border border-line bg-panel px-3 font-mono text-[12px] text-ink shadow-press hover:border-line-strong"
                >
                  {project}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">
            No projects found yet.{" "}
            <button type="button" onClick={onOpenSetup} className="cursor-pointer text-ink underline underline-offset-2">
              Add your project folders
            </button>
            .
          </p>
        )}
        <p className="text-[12px] text-ink-faint">
          Already have Claude running in other terminals?{" "}
          <button type="button" onClick={onOpenSetup} className="cursor-pointer text-ink-muted underline underline-offset-2">
            Connect those sessions
          </button>{" "}
          in Setup.
        </p>
      </div>
    </div>
  );
}
