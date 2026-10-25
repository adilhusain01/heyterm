import { describe, expect, it } from "vitest";
import { Geometry } from "./geometry.ts";

describe("Geometry.roundedPath", () => {
  it("draws a straight connector as one line", () => {
    expect(Geometry.roundedPath([[0, 0], [100, 0]])).toBe("M 0 0 L 100 0");
  });

  // Connectors bend at right angles with a rounded corner, never on a slant.
  it("rounds each bend with a quarter arc of the given radius", () => {
    expect(Geometry.roundedPath([[0, 0], [40, 0], [40, 40]], 8)).toBe("M 0 0 L 32 0 A 8 8 0 0 1 40 8 L 40 40");
  });

  it("turns the arc the other way for a bend to the left", () => {
    expect(Geometry.roundedPath([[0, 40], [40, 40], [40, 0]], 8)).toBe("M 0 40 L 32 40 A 8 8 0 0 0 40 32 L 40 0");
  });

  it("keeps the corner no larger than half the shorter leg", () => {
    expect(Geometry.roundedPath([[0, 0], [8, 0], [8, 40]], 8)).toBe("M 0 0 L 4 0 A 4 4 0 0 1 8 4 L 8 40");
  });
});

describe("Geometry.beamWindow", () => {
  // The beam is a short bright run that travels a straight connector; it starts and ends off the line.
  it("travels from just before the start to just past the end", () => {
    expect(Geometry.beamWindow([0, 10], [100, 10], 30, false)).toEqual({ from: { x1: -30, y1: 10, x2: 0, y2: 10 }, to: { x1: 100, y1: 10, x2: 130, y2: 10 } });
  });

  it("travels the other way for a reply", () => {
    expect(Geometry.beamWindow([0, 10], [100, 10], 30, true)).toEqual({ from: { x1: 130, y1: 10, x2: 100, y2: 10 }, to: { x1: 0, y1: 10, x2: -30, y2: 10 } });
  });

  it("travels down a vertical connector", () => {
    expect(Geometry.beamWindow([20, 0], [20, 80], 20, false)).toEqual({ from: { x1: 20, y1: -20, x2: 20, y2: 0 }, to: { x1: 20, y1: 80, x2: 20, y2: 100 } });
  });
});
