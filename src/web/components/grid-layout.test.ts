import { describe, expect, it } from "vitest";
import { GridLayout } from "./grid-layout.ts";

// Adil, 29 October 2026: four sessions showed as three in a row and one alone below, where a 2x2
// grid fits. The rows a grid needs are filled evenly instead of the first ones to the brim.
describe("GridLayout.columns", () => {
  it("lays four sessions out two by two when three columns fit", () => {
    expect(GridLayout.columns(4, 3)).toBe(2);
  });

  it("puts five in rows of three and two", () => {
    expect(GridLayout.columns(5, 3)).toBe(3);
  });

  it("fills one row when every session fits in it", () => {
    expect(GridLayout.columns(3, 3)).toBe(3);
    expect(GridLayout.columns(2, 4)).toBe(2);
  });

  it("evens out longer grids too", () => {
    expect(GridLayout.columns(7, 4)).toBe(4);
    expect(GridLayout.columns(9, 4)).toBe(3);
    expect(GridLayout.columns(10, 4)).toBe(4);
  });

  it("keeps one column when only one fits, and when there is nothing to show", () => {
    expect(GridLayout.columns(5, 1)).toBe(1);
    expect(GridLayout.columns(0, 3)).toBe(1);
  });
});
