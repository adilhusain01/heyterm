// What a tool the assistant ran gave back, as text the conversation can show when its line is opened.
// Pure.

const keptCharacters = 8_000;

export class ToolOutput {
  // A tool result is either text or a list of blocks; anything but text is named, not dropped.
  static fromToolResult(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
      .map((block: { type?: string; text?: string }) => (block?.type === "text" ? (block.text ?? "") : `[an ${block?.type ?? "unknown part"}]`))
      .join("\n");
  }

  // The end of a long output is kept, where results and errors usually are.
  static capped(output: string, limit = keptCharacters): string {
    if (output.length <= limit) return output;
    const dropped = output.length - limit;
    return `[${dropped.toLocaleString("en-US")} earlier characters not kept]\n${output.slice(-limit)}`;
  }
}
