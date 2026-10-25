// Connector geometry for the page's diagrams. Connectors run at right angles and bend with a quarter
// arc, never on a slant; a beam is a short bright run travelling a straight connector. Pure.

export type Point = [number, number];

export interface GradientLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export class Geometry {
  // An SVG path through the points, each bend rounded. A corner never takes more than half of either leg.
  static roundedPath(points: Point[], radius = 8): string {
    const [first, ...rest] = points;
    if (!first) return "";
    const commands = [`M ${first[0]} ${first[1]}`];
    for (let index = 1; index < points.length; index += 1) {
      const corner = points[index]!;
      const next = points[index + 1];
      if (!next) {
        commands.push(`L ${corner[0]} ${corner[1]}`);
        break;
      }
      const previous = points[index - 1]!;
      const incoming = Geometry.direction(previous, corner);
      const outgoing = Geometry.direction(corner, next);
      const cornerRadius = Math.min(radius, Geometry.distance(previous, corner) / 2, Geometry.distance(corner, next) / 2);
      const before: Point = [corner[0] - incoming[0] * cornerRadius, corner[1] - incoming[1] * cornerRadius];
      const after: Point = [corner[0] + outgoing[0] * cornerRadius, corner[1] + outgoing[1] * cornerRadius];
      // Screen y points down, so a positive cross product is a clockwise turn.
      const clockwise = incoming[0] * outgoing[1] - incoming[1] * outgoing[0] > 0;
      commands.push(`L ${before[0]} ${before[1]}`, `A ${cornerRadius} ${cornerRadius} 0 0 ${clockwise ? 1 : 0} ${after[0]} ${after[1]}`);
    }
    return commands.join(" ");
  }

  // Where a beam's gradient starts and ends: a window of the given length, from just before the line's
  // start to just past its end, or the other way for a reply.
  static beamWindow(start: Point, end: Point, length: number, reverse: boolean): { from: GradientLine; to: GradientLine } {
    const [from, to] = reverse ? [end, start] : [start, end];
    const along = Geometry.direction(from, to);
    const behind: Point = [from[0] - along[0] * length, from[1] - along[1] * length];
    const beyond: Point = [to[0] + along[0] * length, to[1] + along[1] * length];
    return {
      from: { x1: behind[0], y1: behind[1], x2: from[0], y2: from[1] },
      to: { x1: to[0], y1: to[1], x2: beyond[0], y2: beyond[1] },
    };
  }

  private static direction(from: Point, to: Point): Point {
    const length = Geometry.distance(from, to) || 1;
    return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
  }

  private static distance(from: Point, to: Point): number {
    return Math.hypot(to[0] - from[0], to[1] - from[1]);
  }
}
