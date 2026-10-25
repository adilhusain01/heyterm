// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { SessionAvatar } from "./SessionAvatar.tsx";
import type { SessionState } from "../../shared/types.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderAvatar(name: string, state?: SessionState): HTMLElement {
  const container = document.createElement("div");
  act(() => createRoot(container).render(<SessionAvatar name={name} state={state} size={32} />));
  return container;
}

function faceSource(container: HTMLElement): string {
  return container.querySelector("img")?.getAttribute("src") ?? "";
}

describe("SessionAvatar", () => {
  it("draws the session's face as an Adventurer illustration from DiceBear", () => {
    const source = faceSource(renderAvatar("portfolio"));
    expect(source.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(source)).toContain("Lisa Wischofsky");
  });

  it("gives a name the same face every time, and different names different faces", () => {
    expect(faceSource(renderAvatar("portfolio"))).toBe(faceSource(renderAvatar("portfolio")));
    expect(faceSource(renderAvatar("portfolio"))).not.toBe(faceSource(renderAvatar("ultron")));
  });

  it("keeps the face out of the accessibility tree, since the name is always said beside it", () => {
    expect(renderAvatar("portfolio").querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("still shows the state badge on the face", () => {
    expect(renderAvatar("portfolio", "needs_permission").querySelector(".bg-permission")).not.toBeNull();
    expect(renderAvatar("portfolio").querySelector(".bg-permission")).toBeNull();
  });
});
