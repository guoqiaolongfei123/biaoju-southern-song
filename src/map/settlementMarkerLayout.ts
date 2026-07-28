import type { MapDetail } from "./cityLabels";

export interface SettlementMarkerPoint {
  id: string;
  x: number;
  y: number;
  radius: number;
  priority: number;
  fixed?: boolean;
}

export interface SettlementMarkerLayout extends SettlementMarkerPoint {
  markerX: number;
  markerY: number;
  displaced: boolean;
}

const FIRST_RING: Record<MapDetail, number> = { wide: 13, mid: 8, close: 5.4 };

function rotationFor(id: string): number {
  return id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 8;
}

function overlapAmount(a: SettlementMarkerPoint, x: number, y: number, b: SettlementMarkerLayout): number {
  return Math.max(0, a.radius + b.radius + 1.2 - Math.hypot(x - b.markerX, y - b.markerY));
}

/**
 * Gives every independently rendered settlement one readable screen position.
 * The current city can be fixed to its true coordinate; lower-priority cities
 * and aggregate seals move to the nearest free compass slot and retain an
 * anchor line to their geographic coordinate. This closes the gap left by
 * clustering: route cities, offices and capitals stay visible without piling
 * their gates on top of one another.
 */
export function layoutSettlementMarkers(
  points: readonly SettlementMarkerPoint[],
  detail: MapDetail,
): SettlementMarkerLayout[] {
  const ordered = [...points].sort((a, b) =>
    Number(Boolean(b.fixed)) - Number(Boolean(a.fixed))
    || b.priority - a.priority
    || a.id.localeCompare(b.id),
  );
  const occupied: SettlementMarkerLayout[] = [];
  const baseRing = FIRST_RING[detail];
  const compass: Array<[number, number]> = [
    [0, -1], [1, 0], [0, 1], [-1, 0],
    [.72, -.72], [.72, .72], [-.72, .72], [-.72, -.72],
  ];

  for (const point of ordered) {
    if (point.fixed) {
      occupied.push({ ...point, markerX: point.x, markerY: point.y, displaced: false });
      continue;
    }

    const rotation = rotationFor(point.id);
    const directions = [...compass.slice(rotation), ...compass.slice(0, rotation)];
    const ring = Math.max(baseRing, point.radius * 1.35);
    const candidates: Array<[number, number]> = [[0, 0]];
    for (const multiplier of [1, 1.55, 2.15, 2.8]) {
      for (const [dx, dy] of directions) candidates.push([dx * ring * multiplier, dy * ring * multiplier]);
    }

    let best = { x: point.x, y: point.y, overlap: Number.POSITIVE_INFINITY, distance: Number.POSITIVE_INFINITY };
    for (const [dx, dy] of candidates) {
      const x = point.x + dx;
      const y = point.y + dy;
      const overlap = occupied.reduce((sum, other) => sum + overlapAmount(point, x, y, other) ** 2, 0);
      const distance = Math.hypot(dx, dy);
      if (overlap < best.overlap || (overlap === best.overlap && distance < best.distance)) {
        best = { x, y, overlap, distance };
      }
      if (overlap === 0) break;
    }

    occupied.push({
      ...point,
      markerX: best.x,
      markerY: best.y,
      displaced: best.distance > .5,
    });
  }

  return occupied;
}
