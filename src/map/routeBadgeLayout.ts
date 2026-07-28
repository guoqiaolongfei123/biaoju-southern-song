import type { MapDetail } from "./cityLabels";
import type { MapIconObstacle } from "./mapIconLayout";

export interface RouteBadgePoint {
  id: string;
  x: number;
  y: number;
  radius: number;
  priority: number;
}

export interface RouteBadgeLayout extends RouteBadgePoint {
  markerX: number;
  markerY: number;
  displaced: boolean;
}

const FIRST_RING: Record<MapDetail, number> = { wide: 13, mid: 8, close: 5.2 };

function rotationFor(id: string): number {
  return id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 8;
}

function overlapAmount(x: number, y: number, radius: number, obstacle: MapIconObstacle): number {
  return Math.max(0, radius + obstacle.radius + 1.2 - Math.hypot(x - obstacle.x, y - obstacle.y));
}

/**
 * Places all route annotations in one priority queue. Border, condition,
 * deputy and terrain seals therefore negotiate the same space instead of
 * each drawing on the route midpoint and stacking on top of one another.
 */
export function layoutRouteBadges(
  points: readonly RouteBadgePoint[],
  obstacles: readonly MapIconObstacle[],
  detail: MapDetail,
): RouteBadgeLayout[] {
  const occupied: MapIconObstacle[] = [...obstacles];
  const ordered = [...points].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const compass: Array<[number, number]> = [
    [0, 0],
    [0, -1], [1, 0], [0, 1], [-1, 0],
    [.72, -.72], [.72, .72], [-.72, .72], [-.72, -.72],
    [0, -2], [2, 0], [0, 2], [-2, 0],
    [1.45, -1.45], [1.45, 1.45], [-1.45, 1.45], [-1.45, -1.45],
  ];

  return ordered.map((point) => {
    const ring = Math.max(FIRST_RING[detail], point.radius * 1.7);
    const rotation = rotationFor(point.id);
    const candidates = [compass[0], ...compass.slice(1 + rotation, 9), ...compass.slice(1, 1 + rotation), ...compass.slice(9)];
    let best = { x: point.x, y: point.y, score: Number.POSITIVE_INFINITY, distance: 0 };

    for (const [dx, dy] of candidates) {
      const x = point.x + dx * ring;
      const y = point.y + dy * ring;
      const overlap = occupied.reduce((sum, obstacle) => sum + overlapAmount(x, y, point.radius, obstacle) ** 2, 0);
      const distance = Math.hypot(x - point.x, y - point.y);
      const score = overlap * 120 + distance;
      if (score < best.score) best = { x, y, score, distance };
      if (overlap === 0 && distance === 0) break;
    }

    occupied.push({ id: point.id, x: best.x, y: best.y, radius: point.radius });
    return {
      ...point,
      markerX: best.x,
      markerY: best.y,
      displaced: best.distance > .5,
    };
  });
}
