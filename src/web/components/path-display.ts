// A folder path in the room a row has: the end of it, which names the folder, with the start elided.

const keptSegments = 3;

export class PathDisplay {
  static tail(fullPath: string): string {
    const separator = fullPath.includes("\\") && !fullPath.includes("/") ? "\\" : "/";
    const segments = fullPath.split(separator).filter((segment) => segment.length > 0);
    if (segments.length <= keptSegments) return fullPath;
    return `…${separator}${segments.slice(-keptSegments).join(separator)}`;
  }
}
