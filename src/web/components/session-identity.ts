// How a session is recognised at a glance: its initials on a soft colour of its own, and a clean
// preview of what was last asked of it.

export class SessionIdentity {
  // "portfolio" is P, "docs-site" is DS, "web-2" is W2.
  static initials(name: string): string {
    const parts = name.split(/[\s_-]+/).filter(Boolean);
    if (parts.length <= 1) return (parts[0] ?? name).charAt(0).toUpperCase();
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  // A hue from the name, spread around the colour wheel so neighbours rarely look alike.
  static hue(name: string): number {
    let hash = 2166136261;
    for (const character of name) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    return Math.round((hash * 137.508) % 360);
  }

  // What the person asked, without system blocks (<task-notification>…</task-notification>) or
  // markers such as [Image #17] that tools add to a prompt.
  static promptPreview(prompt: string): string {
    const withoutBlocks = prompt.replace(/<([a-z][\w-]*)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
    const withoutMarkers = withoutBlocks.replace(/\[(?:Image|Pasted text|File)[^\]]*\]/gi, " ");
    return (withoutMarkers.split("\n").find((line) => line.trim()) ?? "").replace(/\s+/g, " ").trim();
  }
}
