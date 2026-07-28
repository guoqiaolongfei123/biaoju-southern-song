import type { MapDetail } from "./cityLabels";
import type { MapIconObstacle } from "./mapIconLayout";

export interface WeatherMarkerPoint {
  id: string;
  x: number;
  y: number;
  offsetX?: number;
  offsetY?: number;
}

export interface WeatherMarkerLayout extends WeatherMarkerPoint {
  markerX: number;
  markerY: number;
  radius: number;
}

// The radius covers the complete cartouche including its long regional label,
// not just the painted paper shape. This prevents a visually clear weather
// layer from masking route, border or city seals at close zoom.
const MARKER_RADIUS: Record<MapDetail, number> = { wide: 42, mid: 34, close: 29 };
const SEARCH_RING: Record<MapDetail, number> = { wide: 48, mid: 38, close: 32 };

function overlapAmount(x: number, y: number, radius: number, obstacle: MapIconObstacle): number {
  return Math.max(0, radius + obstacle.radius - Math.hypot(x - obstacle.x, y - obstacle.y));
}

function rotationFor(id: string): number {
  return id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 8;
}

/** Places large weather cartouches after gameplay icons have been laid out. */
export function layoutWeatherMarkers(
  points: readonly WeatherMarkerPoint[],
  obstacles: readonly MapIconObstacle[],
  detail: MapDetail,
): WeatherMarkerLayout[] {
  const occupied = [...obstacles];
  return [...points].sort((a, b) => a.id.localeCompare(b.id)).map((point) => {
    const preferredX = point.x + (point.offsetX ?? 0);
    const preferredY = point.y + (point.offsetY ?? 0);
    const radius = MARKER_RADIUS[detail];
    const ring = SEARCH_RING[detail];
    const directions: Array<[number, number]> = [
      [0, 0], [0, -1], [1, 0], [0, 1], [-1, 0],
      [.72, -.72], [.72, .72], [-.72, .72], [-.72, -.72],
      [0, -1.65], [1.65, 0], [0, 1.65], [-1.65, 0],
      [1.7, -1.7], [1.7, 1.7], [-1.7, 1.7], [-1.7, -1.7],
      [0, -2.65], [2.65, 0], [0, 2.65], [-2.65, 0],
    ];
    const rotation = rotationFor(point.id);
    const candidates = [directions[0], ...directions.slice(1 + rotation, 9), ...directions.slice(1, 1 + rotation), ...directions.slice(9)];
    let best = { x: preferredX, y: preferredY, score: Number.POSITIVE_INFINITY };
    for (const [dx, dy] of candidates) {
      const x = preferredX + dx * ring;
      const y = preferredY + dy * ring;
      const overlap = occupied.reduce((sum, obstacle) => sum + overlapAmount(x, y, radius + 1.5, obstacle), 0);
      const score = overlap * 100 + Math.hypot(x - point.x, y - point.y) * .35;
      if (score < best.score) best = { x, y, score };
      if (overlap === 0 && dx === 0 && dy === 0) break;
    }
    occupied.push({ id: `weather:${point.id}`, x: best.x, y: best.y, radius });
    return { ...point, markerX: best.x, markerY: best.y, radius };
  });
}
