import type { RouteLandmarkKind } from "../core/routeLandmarkContent";
import type { MapDetail } from "./cityLabels";
import type { MapIconObstacle } from "./mapIconLayout";

export interface RouteLandmarkPoint {
  id: string;
  kind: RouteLandmarkKind;
  prominence: "major" | "local";
  pinned: boolean;
  x: number;
  y: number;
}

export interface RouteLandmarkLayout {
  id: string;
  landmarkIds: string[];
  primaryLandmarkId: string;
  pinned: boolean;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  radius: number;
}

const GROUP_DISTANCE: Record<MapDetail, number> = { wide: 28, mid: 13, close: 6.5 };
const ICON_RADIUS: Record<MapDetail, number> = { wide: 8.6, mid: 6.3, close: 4.5 };
const FIRST_RING: Record<MapDetail, number> = { wide: 15, mid: 9, close: 5.5 };
const KIND_PRIORITY: Record<RouteLandmarkKind, number> = { pass: 6, ferry: 5, fort: 4, post: 3, market: 2, temple: 1 };

function priority(point: RouteLandmarkPoint): number {
  return (point.pinned ? 100 : 0) + (point.prominence === "major" ? 20 : 0) + KIND_PRIORITY[point.kind];
}

function hashRotation(id: string): number {
  return id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 8;
}

function overlapAmount(x: number, y: number, radius: number, obstacle: MapIconObstacle): number {
  return Math.max(0, radius + obstacle.radius - Math.hypot(x - obstacle.x, y - obstacle.y));
}

/** Merge nearby route sites into one annotated seal and move it to the nearest
 * free compass slot. The true geographic position is retained as an anchor line. */
export function layoutRouteLandmarks(
  points: readonly RouteLandmarkPoint[],
  obstacles: readonly MapIconObstacle[],
  detail: MapDetail,
): RouteLandmarkLayout[] {
  const ordered = [...points].sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id));
  const groups: RouteLandmarkPoint[][] = [];
  const threshold = GROUP_DISTANCE[detail];

  for (const point of ordered) {
    const group = groups.find((candidate) => {
      const centerX = candidate.reduce((sum, item) => sum + item.x, 0) / candidate.length;
      const centerY = candidate.reduce((sum, item) => sum + item.y, 0) / candidate.length;
      return Math.hypot(point.x - centerX, point.y - centerY) < threshold;
    });
    if (group) group.push(point);
    else groups.push([point]);
  }

  const occupied: MapIconObstacle[] = [...obstacles];
  return groups.map((group) => {
    const sorted = [...group].sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id));
    const anchorX = group.reduce((sum, point) => sum + point.x, 0) / group.length;
    const anchorY = group.reduce((sum, point) => sum + point.y, 0) / group.length;
    const radius = ICON_RADIUS[detail] + (group.length > 1 ? 1.4 : 0);
    const ring = FIRST_RING[detail];
    const directions = [
      [0, 0],
      [0, -1], [1, 0], [0, 1], [-1, 0],
      [.72, -.72], [.72, .72], [-.72, .72], [-.72, -.72],
      [0, -2], [2, 0], [0, 2], [-2, 0],
      [1.45, -1.45], [1.45, 1.45], [-1.45, 1.45], [-1.45, -1.45],
    ];
    const rotation = hashRotation(sorted.map((point) => point.id).join("|"));
    const compass = [directions[0], ...directions.slice(1 + rotation, 9), ...directions.slice(1, 1 + rotation), ...directions.slice(9)];
    let best = { x: anchorX, y: anchorY, score: Number.POSITIVE_INFINITY };

    for (const [dx, dy] of compass) {
      const x = anchorX + dx * ring;
      const y = anchorY + dy * ring;
      const overlap = occupied.reduce((sum, obstacle) => sum + overlapAmount(x, y, radius + 1.1, obstacle), 0);
      const score = overlap * 100 + Math.hypot(x - anchorX, y - anchorY);
      if (score < best.score) best = { x, y, score };
      if (overlap === 0) break;
    }

    const id = sorted.map((point) => point.id).join("+");
    occupied.push({ id: `landmark:${id}`, x: best.x, y: best.y, radius });
    return {
      id,
      landmarkIds: sorted.map((point) => point.id),
      primaryLandmarkId: sorted[0].id,
      pinned: sorted.some((point) => point.pinned),
      x: best.x,
      y: best.y,
      anchorX,
      anchorY,
      radius,
    };
  });
}
