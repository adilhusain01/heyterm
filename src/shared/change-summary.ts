// What a session changed in its last task, in words that can be said out loud: the files its own
// hooks reported (so two sessions in one repository each report their own), with line counts from
// git where it has them. Pure.

export interface LineCounts {
  added: number;
  removed: number;
}

export interface ChangeSummaryResult {
  files: string[];
  spoken: string;
}

const filesNamedAtMost = 3;

export class ChangeSummary {
  static describe(sessionName: string, files: string[], lineCounts: Map<string, LineCounts> | undefined): ChangeSummaryResult {
    if (files.length === 0) return { files, spoken: `${sessionName} has not changed any files in its last task.` };
    const fileWord = files.length === 1 ? "file" : "files";
    const opening = `${sessionName} changed ${files.length} ${fileWord} in its last task`;
    if (files.length > filesNamedAtMost) return { files, spoken: `${opening}, most of them in ${mostCommonFolder(files)}.` };
    const names = joinedAsList(files.map((file) => file.split("/").pop() ?? file));
    return { files, spoken: `${opening}: ${names}.${lineSentence(files, lineCounts)}` };
  }

  static parseNumstat(output: string): Map<string, LineCounts> {
    const counts = new Map<string, LineCounts>();
    for (const line of output.split("\n")) {
      const [added, removed, file] = line.split("\t");
      if (!file) continue;
      // Binary files show "-" for both counts.
      counts.set(file, { added: Number(added) || 0, removed: Number(removed) || 0 });
    }
    return counts;
  }
}

function lineSentence(files: string[], lineCounts: Map<string, LineCounts> | undefined): string {
  if (!lineCounts) return "";
  const known = files.map((file) => lineCounts.get(file)).filter((counts): counts is LineCounts => counts !== undefined);
  if (known.length === 0) return "";
  const added = known.reduce((total, counts) => total + counts.added, 0);
  const removed = known.reduce((total, counts) => total + counts.removed, 0);
  return ` Since the last commit, ${added} ${added === 1 ? "line" : "lines"} added and ${removed} removed.`;
}

function mostCommonFolder(files: string[]): string {
  const counts = new Map<string, number>();
  for (const file of files) {
    const folder = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "the top folder";
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return [...counts].sort((first, second) => second[1] - first[1])[0]![0];
}

function joinedAsList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
