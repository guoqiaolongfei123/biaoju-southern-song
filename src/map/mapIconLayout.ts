import type { WorldActorKind } from "../core/types";
import type { MapDetail } from "./cityLabels";

export interface MapActorPoint {
  id: string;
  kind: WorldActorKind;
  x: number;
  y: number;
}

export interface MapIconObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface MapActorLayout {
  id: string;
  actorIds: string[];
  primaryActorId: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  radius: number;
}

const KIND_PRIORITY: Record<WorldActorKind, number> = {
  army: 4,
  patrol: 3,
  rival: 2,
  merchant: 1,
};

const GROUP_DISTANCE: Record<MapDetail, number> = { wide: 22, mid: 10, close: 6.5 };
const ICON_RADIUS: Record<MapDetail, number> = { wide: 10.5, mid: 7.2, close: 4.8 };
const FIRST_RING: Record<MapDetail, number> = { wide: 16, mid: 9, close: 6 };

function distance(a: Pick<MapActorPoint, "x" | "y">, b: Pick<MapActorPoint, "x" | "y">): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hashRotation(id: string): number {
  return id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 8;
}

function overlapAmount(x: number, y: number, radius: number, obstacle: MapIconObstacle): number {
  return Math.max(0, radius + obstacle.radius - Math.hypot(x - obstacle.x, y - obstacle.y));
}

/**
 * Keeps moving road actors readable at every map scale. Overview levels merge
 * near-identical road positions into one stack. Callers can disable grouping
 * at the maximum zoom so close-range stacks fan back into individual actors.
 * Every resulting icon is then moved to the nearest free compass slot around
 * its true route position, avoiding city architecture and earlier actor marks
 * without losing the underlying geographic anchor.
 */
export function layoutMapActors(
  actors: readonly MapActorPoint[],
  cityObstacles: readonly MapIconObstacle[],
  detail: MapDetail,
  groupNearby = true,
  radiusPadding = 0,
): MapActorLayout[] {
  const ordered = [...actors].sort((a, b) =>
    KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind] || a.id.localeCompare(b.id),
  );
  const groups: MapActorPoint[][] = [];
  const threshold = groupNearby ? GROUP_DISTANCE[detail] : 0;

  for (const actor of ordered) {
    const group = threshold > 0
      ? groups.find((candidate) => {
        const center = {
          x: candidate.reduce((sum, item) => sum + item.x, 0) / candidate.length,
          y: candidate.reduce((sum, item) => sum + item.y, 0) / candidate.length,
        };
        return distance(actor, center) < threshold;
      })
      : undefined;
    if (group) group.push(actor);
    else groups.push([actor]);
  }

  const occupied: MapIconObstacle[] = [...cityObstacles];
  return groups.map((group) => {
    const sorted = [...group].sort((a, b) => KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind] || a.id.localeCompare(b.id));
    const anchorX = group.reduce((sum, actor) => sum + actor.x, 0) / group.length;
    const anchorY = group.reduce((sum, actor) => sum + actor.y, 0) / group.length;
    const radius = ICON_RADIUS[detail] + (group.length > 1 ? 1.5 : 0) + Math.max(0, radiusPadding);
    const ring = FIRST_RING[detail];
    const directions = [
      [0, 0],
      [0, -1], [1, 0], [0, 1], [-1, 0],
      [.72, -.72], [.72, .72], [-.72, .72], [-.72, -.72],
      [0, -2], [2, 0], [0, 2], [-2, 0],
      [1.45, -1.45], [1.45, 1.45], [-1.45, 1.45], [-1.45, -1.45],
      [0, -3], [3, 0], [0, 3], [-3, 0],
      [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2], [-2.2, -2.2],
    ];
    const rotation = hashRotation(sorted.map((actor) => actor.id).join("|"));
    const compass = [directions[0], ...directions.slice(1 + rotation, 9), ...directions.slice(1, 1 + rotation), ...directions.slice(9)];
    let best = { x: anchorX, y: anchorY, score: Number.POSITIVE_INFINITY };

    for (const [dx, dy] of compass) {
      const x = anchorX + dx * ring;
      const y = anchorY + dy * ring;
      const overlap = occupied.reduce((sum, obstacle) => sum + overlapAmount(x, y, radius + 1.4, obstacle), 0);
      const score = overlap * 100 + Math.hypot(x - anchorX, y - anchorY);
      if (score < best.score) best = { x, y, score };
      if (overlap === 0) break;
    }

    const id = sorted.map((actor) => actor.id).join("+");
    occupied.push({ id: `actor:${id}`, x: best.x, y: best.y, radius });
    return {
      id,
      actorIds: sorted.map((actor) => actor.id),
      primaryActorId: sorted[0].id,
      x: best.x,
      y: best.y,
      anchorX,
      anchorY,
      radius,
    };
  });
}
