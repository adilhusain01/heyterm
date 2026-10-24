// Connection, how long agents have waited on you today, the hands-off meter and the sound mode.

import { useCallsign } from "../app-context.tsx";
import { isPlayground } from "../playground/is-playground.ts";
import { useCallsignStore } from "../state/callsign-store.ts";
import { useServerNow } from "../state/use-server-now.ts";
import { Key } from "../ui/Key.tsx";
import { SpeakerIcon, SpeakerMutedIcon, SpeakerQuietIcon } from "./icons.tsx";
import { isWaitingOnUser, shortDuration } from "./session-display.ts";
import type { AnnouncementMode } from "../../shared/types.ts";

const nextMode: Record<AnnouncementMode, AnnouncementMode> = { speak: "quiet", quiet: "mute", mute: "speak" };
const modeLabel: Record<AnnouncementMode, string> = { speak: "Speaking", quiet: "Quiet", mute: "Muted" };

export function TopBar({ onOpenSetup }: { onOpenSetup: () => void }) {
  const { perform } = useCallsign();
  const connectionStatus = useCallsignStore((state) => state.connectionStatus);
  const sessions = useCallsignStore((state) => state.sessions);
  const mode = useCallsignStore((state) => state.control.mode);
  const handsOff = useCallsignStore((state) => state.handsOff);
  const now = useServerNow();

  const waitedToday = sessions.reduce((total, session) => {
    const liveWait = isWaitingOnUser(session.state) ? now - session.stateSince : 0;
    return total + session.waitedMillisecondsToday + liveWait;
  }, 0);
  const voiceShare = handsOff.voiceShare;
  const ModeIcon = mode === "speak" ? SpeakerIcon : mode === "quiet" ? SpeakerQuietIcon : SpeakerMutedIcon;

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-meta font-medium tracking-tight text-ink">callsign</span>
        <ConnectionMark status={connectionStatus} />
        {isPlayground && <span className="rounded-mark border border-line px-1.5 py-0.5 text-[12.5px] text-ink-muted">Playground, simulated agents</span>}
      </div>
      <div className="ml-auto flex items-center gap-2 text-meta text-ink-muted">
        <Stat label="Waited on you today" value={shortDuration(waitedToday)} />
        <Stat
          label="Hands off"
          value={voiceShare === undefined ? "–" : `${Math.round(voiceShare * 100)}%`}
          title={`${handsOff.voice} by voice, ${handsOff.keyboard} by keyboard, ${handsOff.pointer} by pointer today`}
        />
        <Key
          onClick={() => perform({ type: "mode", mode: nextMode[mode] })}
          title="Speaking says everything, Quiet only permissions and questions, Muted plays sounds only. Or say: be quiet, mute, talk to me."
          className="ml-2"
        >
          <ModeIcon size={15} />
          <span>{modeLabel[mode]}</span>
        </Key>
        <Key onClick={onOpenSetup}>{isPlayground ? "Install" : "Setup"}</Key>
      </div>
    </header>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <span className="hidden h-8 items-center gap-2 rounded-inner border border-line bg-tray px-2.5 shadow-tray md:flex" title={title}>
      <span>{label}</span>
      <span className="font-mono text-ink tabular-nums">{value}</span>
    </span>
  );
}

function ConnectionMark({ status }: { status: string }) {
  if (status === "open") return null;
  if (status === "needs_token") return <span className="rounded-mark bg-permission/15 px-1.5 py-0.5 text-[12.5px] text-permission">Open Callsign by running callsign in a terminal</span>;
  return <span className="rounded-mark bg-permission/15 px-1.5 py-0.5 text-[12.5px] text-permission">{status === "connecting" ? "Connecting" : "Reconnecting"}</span>;
}
