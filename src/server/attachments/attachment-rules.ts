// Images dropped or pasted onto a session's pane: which are accepted, what the file is called, and
// what is pasted into the session. Pasting a file's path is what a terminal does when an image is
// dragged into it, and Claude Code attaches an image path it is given. Pure.

const extensionsByType: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

export class AttachmentRules {
  static readonly largestBytes = 20 * 1024 * 1024;

  static extensionFor(contentType: string): string | undefined {
    return extensionsByType[contentType.split(";")[0]!.trim().toLowerCase()];
  }

  static fileName(sessionName: string, extension: string, now: Date, randomPart: string): string {
    const two = (value: number) => String(value).padStart(2, "0");
    const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
    return `${sessionName}-${stamp}-${randomPart}.${extension}`;
  }

  static pastedText(filePath: string): string {
    return `${filePath.includes(" ") ? `"${filePath}"` : filePath} `;
  }
}
