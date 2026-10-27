// The + picker: which agent, and where. A project from the list, any folder by typing its path
// (folders are suggested as you type, as in VS Code's Open Folder), or the system's folder dialog.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useHeyTerm } from "../app-context.tsx";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { chooseFolder, suggestFolders } from "../transport/folders.ts";
import { FolderIcon } from "../ui/icons.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { Tray } from "../ui/Surfaces.tsx";
import { FolderPath } from "./folder-path.ts";
import type { FolderSuggestionList } from "../../shared/protocol.ts";
import type { AgentKind } from "../../shared/types.ts";

// Typing pauses this long before the folders are looked up.
const suggestionDelayMilliseconds = 120;
const rowClass = "flex min-w-0 cursor-pointer items-center gap-2 rounded-tiny px-2 py-1.5 text-left font-mono text-meta text-ink transition-colors duration-150 hover:bg-raised";

export function NewSessionPicker({ onDone }: { onDone: () => void }) {
  const { perform } = useHeyTerm();
  const projects = useHeyTermStore((state) => state.projects);
  // Selected whole and filtered here: a selector returning a new array each time re-renders forever.
  const agents = useHeyTermStore((state) => state.setup?.agents);
  const folderDialogAvailable = useHeyTermStore((state) => state.setup?.folderDialogAvailable ?? false);
  const installedAgents = useMemo(() => (agents ?? []).filter((agent) => agent.version), [agents]);
  const [filter, setFilter] = useState("");
  const [agent, setAgent] = useState<AgentKind>("claude");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFolderPath = FolderPath.looksLikePath(filter);
  const folders = useFolderSuggestions(isFolderPath ? filter : "");
  const agentOptions = [...installedAgents.map((installed) => ({ value: installed.kind, label: installed.label.replace(" CLI", "").replace(" Code", "") })), { value: "shell" as AgentKind, label: "Terminal" }];
  const shownProjects = projects.filter((project) => project.includes(filter.toLowerCase())).slice(0, 10);

  // A project by its name, or a folder by its full path; HeyTerm names the session after the folder.
  const start = (projectOrFolder: string) => {
    perform({ type: "spawn", project: projectOrFolder, ...(agent === "claude" ? {} : { agent }) });
    onDone();
  };
  const goInto = (shownPath: string) => {
    setFilter(`${shownPath}/`);
    inputRef.current?.focus();
  };
  const startFromDialog = async () => {
    setDialogOpen(true);
    const chosen = await chooseFolder();
    setDialogOpen(false);
    if (chosen.error) toast.warning(chosen.error);
    if (chosen.path) start(chosen.path);
  };
  const startWithEnter = () => {
    if (isFolderPath && folders?.folder) start(folders.folder.path);
    else if (!isFolderPath && shownProjects[0]) start(shownProjects[0]);
  };

  return (
    <Tray className="enter-rise mb-1 flex flex-col gap-1 p-1">
      {/* A plain terminal needs nothing installed, so there is always a choice to make here. */}
      {/* Up to three choices fit one row of the sidebar; more go into rows of three. */}
      <Segmented label="Agent" stretch columns={agentOptions.length > 3 ? 3 : undefined} value={agent} onChange={setAgent} options={agentOptions} />
      <input
        ref={inputRef}
        autoFocus
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDone();
          if (event.key === "Enter") startWithEnter();
        }}
        placeholder="Find a project, or type a path like ~/"
        aria-label="Project or folder"
        className="h-8 rounded-tiny border border-line bg-panel px-2.5 text-meta text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
      />
      {isFolderPath ? (
        <FolderRows folders={folders} onStart={start} onGoInto={goInto} />
      ) : (
        <>
          {shownProjects.map((project) => (
            <button key={project} type="button" onClick={() => start(project)} className={rowClass}>
              <SessionAvatar name={project} size={18} />
              <span className="truncate">{project}</span>
            </button>
          ))}
          {shownProjects.length === 0 && <p className="px-2.5 py-1.5 text-meta text-ink-faint">No project matches. Type a path like ~/ to open any folder.</p>}
        </>
      )}
      {folderDialogAvailable && (
        <button type="button" disabled={isDialogOpen} onClick={() => void startFromDialog()} className={`${rowClass} border-t border-line font-sans text-ink-muted hover:text-ink disabled:cursor-default disabled:text-ink-faint disabled:hover:bg-transparent`}>
          <FolderIcon size={16} className="shrink-0" />
          <span className="truncate">{isDialogOpen ? "Pick the folder in the dialog…" : "Choose a folder…"}</span>
        </button>
      )}
    </Tray>
  );
}

// The typed folder to start in, then the folders inside it to go into.
function FolderRows({ folders, onStart, onGoInto }: { folders: FolderSuggestionList | undefined; onStart: (folder: string) => void; onGoInto: (shownPath: string) => void }) {
  if (!folders) return <p className="px-2.5 py-1.5 text-meta text-ink-faint">Looking…</p>;
  const typedFolder = folders.folder;
  const folderName = typedFolder?.shownPath.split(/[\\/]/).filter(Boolean).pop() ?? "/";
  return (
    <>
      {typedFolder && (
        <button type="button" onClick={() => onStart(typedFolder.path)} title={typedFolder.path} className={rowClass}>
          <SessionAvatar name={folderName} size={18} />
          {/* The input holds the whole path; the folder's own name is what tells it apart. */}
          <span className="truncate">{folderName}</span>
          <span className="ml-auto shrink-0 font-sans text-small text-ink-faint">Start here</span>
        </button>
      )}
      {folders.suggestions.map((suggestion) => (
        <button key={suggestion.path} type="button" onClick={() => onGoInto(suggestion.shownPath)} title={suggestion.path} className={rowClass}>
          <FolderIcon size={16} className="shrink-0 text-ink-faint" />
          <span className="truncate">{suggestion.shownPath.split("/").pop() || suggestion.shownPath}</span>
          <span aria-hidden className="ml-auto shrink-0 text-ink-faint">›</span>
        </button>
      ))}
      {!typedFolder && folders.suggestions.length === 0 && <p className="px-2.5 py-1.5 text-meta text-ink-faint">No folder there.</p>}
    </>
  );
}

// The folders for a typed path, looked up once typing pauses; an answer for an older text is dropped.
function useFolderSuggestions(typed: string): FolderSuggestionList | undefined {
  const [result, setResult] = useState<{ typed: string; folders: FolderSuggestionList } | undefined>();
  useEffect(() => {
    if (!typed) return;
    let isCurrent = true;
    const timer = window.setTimeout(() => {
      void suggestFolders(typed).then((folders) => {
        if (isCurrent) setResult({ typed, folders: folders ?? { suggestions: [] } });
      });
    }, suggestionDelayMilliseconds);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [typed]);
  // Until the new answer arrives the last one stays, so the list does not flicker while typing.
  return typed ? result?.folders : undefined;
}
