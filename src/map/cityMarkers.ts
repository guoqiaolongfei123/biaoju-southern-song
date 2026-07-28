import type { CityDefinition } from "../core/types";
import type { MapDetail } from "./cityLabels";

export interface MapMarkerPoint {
  x: number;
  y: number;
}

function markerPriority(city: CityDefinition, pinned: Set<string>): number {
  if (pinned.has(city.id)) return 1_000;
  if (city.tier === "capital") return 800;
  if (city.tier === "major") return 400;
  return 100;
}

function minimumSpacing(detail: MapDetail): number {
  if (detail === "wide") return 30;
  if (detail === "mid") return 14;
  return 13;
}

/**
 * Chooses the cities that receive a full architectural marker at the current
 * map scale. Every other city still renders as a compact settlement mark, so
 * the historical network remains visible without stacking dozens of gates.
 */
export function detailedCityIds(
  cities: CityDefinition[],
  detail: MapDetail,
  pinned: Set<string>,
): Set<string> {
  const spacing = minimumSpacing(detail);
  const detailed = new Set<string>();
  const accepted: CityDefinition[] = [];
  const ordered = [...cities].sort((a, b) =>
    markerPriority(b, pinned) - markerPriority(a, pinned)
    || a.y - b.y
    || a.x - b.x
    || a.id.localeCompare(b.id),
  );

  for (const city of ordered) {
    const required = pinned.has(city.id) || city.tier === "capital";
    const eligible = required || city.tier === "major" || detail === "close";
    if (!eligible) continue;

    const citySpacing = detail === "close" && city.tier === "major" ? 10 : spacing;
    const crowded = accepted.some((other) => Math.hypot(city.x - other.x, city.y - other.y) < citySpacing);
    if (!required && crowded) continue;
    detailed.add(city.id);
    accepted.push(city);
  }

  return detailed;
}

/**
 * Resolves overlapping transparent hit areas by selecting the city whose
 * actual map coordinate is closest to the pointer. This keeps generous mouse
 * targets without letting a later-painted neighbour steal the click.
 */
export function nearestCityToPoint(
  cities: CityDefinition[],
  point: MapMarkerPoint,
): CityDefinition | undefined {
  let nearest: CityDefinition | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const city of cities) {
    const distance = Math.hypot(city.x - point.x, city.y - point.y);
    if (distance >= nearestDistance) continue;
    nearest = city;
    nearestDistance = distance;
  }

  return nearest;
}
