// Session names the user can say: lowercase words joined by hyphens. Used when renaming a session,
// by the page before it asks and by the server before it does it. Pure.

const longestName = 40;

export class SessionNames {
  static fromTyped(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Why a session cannot take this name, or undefined when it can.
  static renameProblem(newName: string, currentName: string, takenNames: string[]): string | undefined {
    if (!newName) return "Give it a name with a letter or a number.";
    if (newName.length > longestName) return `Keep it to ${longestName} characters.`;
    if (newName === currentName) return `It is already called ${newName}.`;
    if (takenNames.includes(newName)) return `There is already a session called ${newName}.`;
    return undefined;
  }
}
