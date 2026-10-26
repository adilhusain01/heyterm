// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown.tsx";
import { FoldedText } from "./FoldedText.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const longCommand = "! cd /private/tmp/claude-501/-Users-adilhusain-Documents-Projects/scratchpad/ht-release && npm run build";

function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  act(() => createRoot(container).render(element));
  return container;
}

function copiedText(): ReturnType<typeof vi.fn> {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Markdown code blocks", () => {
  // Adil, 26 October 2026: a production command in the assistant's answer could only be read by
  // scrolling it sideways and had no way to copy it.
  it("have a copy button that copies exactly the command", async () => {
    const writeText = copiedText();
    const container = render(<Markdown text={"Production command:\n\n```\n" + longCommand + "\n```"} />);
    const button = container.querySelector<HTMLButtonElement>("button[aria-label='Copy']");
    expect(button).not.toBeNull();
    await act(async () => button!.click());
    expect(writeText).toHaveBeenCalledWith(longCommand);
    expect(container.querySelector("button[aria-label='Copied']")).not.toBeNull();
  });

  it("wrap the whole command instead of hiding it past the edge", () => {
    const container = render(<Markdown text={"```\n" + longCommand + "\n```"} />);
    const block = container.querySelector("pre")!;
    expect(block.className).toContain("whitespace-pre-wrap");
    expect(block.className).not.toContain("overflow-x-auto");
  });

  it("leave inline code without a button", () => {
    const container = render(<Markdown text="Run `npm test` first." />);
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("FoldedText", () => {
  it("copies the whole text even while it is folded", async () => {
    const writeText = copiedText();
    const command = Array.from({ length: 12 }, (_, index) => `step ${index}`).join("\n");
    const container = render(<FoldedText text={command} />);
    await act(async () => container.querySelector<HTMLButtonElement>("button[aria-label='Copy']")!.click());
    expect(writeText).toHaveBeenCalledWith(command);
  });
});
