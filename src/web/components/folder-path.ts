// Whether what was typed in the picker is a folder path to open rather than a project to find. Pure.

export class FolderPath {
  static looksLikePath(text: string): boolean {
    return text.startsWith("~") || text.startsWith("/") || /^[A-Za-z]:[\\/]/.test(text);
  }
}
