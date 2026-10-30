import { describe, expect, it } from "vitest";
import { TerminalSizes } from "./terminal-sizes.ts";

// The pane in a half-width grid, and the same session alone in another tab (30 October 2026).
const halfWidth = () => ({ columns: 106, rows: 44 });
const fullWidth = () => ({ columns: 218, rows: 44 });

describe("TerminalSizes", () => {
  it("gives the terminal back to the pane typed into when another pane set its size since", () => {
    const sizes = new TerminalSizes();
    const typedInto = halfWidth();
    const otherTab = fullWidth();
    sizes.opened("heyterm", typedInto, { isInUse: true });
    sizes.opened("heyterm", otherTab, { isInUse: true });
    expect(sizes.used("heyterm", typedInto)).toEqual({ columns: 106, rows: 44 });
    expect(sizes.used("heyterm", typedInto)).toBeUndefined();
  });

  it("leaves the size alone while the pane that set it is the one used", () => {
    const sizes = new TerminalSizes();
    const pane = halfWidth();
    sizes.opened("heyterm", pane, { isInUse: true });
    expect(sizes.used("heyterm", pane)).toBeUndefined();
  });

  it("follows a pane resized to a new size", () => {
    const sizes = new TerminalSizes();
    const pane = halfWidth();
    sizes.opened("heyterm", pane, { isInUse: true });
    pane.columns = 150;
    expect(sizes.used("heyterm", pane)).toEqual({ columns: 150, rows: 44 });
  });

  it("restores the size of the pane in use when a tab in the background opens a pane", () => {
    const sizes = new TerminalSizes();
    sizes.opened("heyterm", halfWidth(), { isInUse: true });
    expect(sizes.opened("heyterm", fullWidth(), { isInUse: false })).toEqual({ columns: 106, rows: 44 });
  });

  it("lets the first pane of a terminal set its size, even from a tab in the background", () => {
    const sizes = new TerminalSizes();
    expect(sizes.opened("heyterm", fullWidth(), { isInUse: false })).toBeUndefined();
  });

  it("goes back to the pane used last when the pane that set the size closes", () => {
    const sizes = new TerminalSizes();
    const stays = halfWidth();
    const closes = fullWidth();
    sizes.opened("heyterm", stays, { isInUse: true });
    sizes.opened("heyterm", closes, { isInUse: true });
    expect(sizes.closed("heyterm", closes)).toEqual({ columns: 106, rows: 44 });
    expect(sizes.closed("heyterm", stays)).toBeUndefined();
  });

  it("keeps each terminal's panes apart", () => {
    const sizes = new TerminalSizes();
    const heyterm = halfWidth();
    sizes.opened("heyterm", heyterm, { isInUse: true });
    sizes.opened("layoutgen", fullWidth(), { isInUse: true });
    expect(sizes.used("heyterm", heyterm)).toBeUndefined();
  });
});
