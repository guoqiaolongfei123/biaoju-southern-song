import type { CityDefinition } from "../core/types";
import type { MapDetail } from "./cityLabels";

export interface CityMarkerCluster {
  id: string;
  cityIds: string[];
  primaryCityId: string;
  x: number;
  y: number;
  radius: number;
}

const CLUSTER_DISTANCE: Record<MapDetail, number> = { wide: 25, mid: 12, close: 7.5 };
const CLUSTER_RADIUS: Record<MapDetail, number> = { wide: 7.8, mid: 5.6, close: 3.2 };
const MAX_CLUSTER_SIZE: Record<MapDetail, number> = { wide: 6, mid: 4, close: 2 };

function cityPriority(city: CityDefinition): number {
  return city.tier === "capital" ? 3 : city.tier === "major" ? 2 : 1;
}

/**
 * Groups nearby settlement marks at overview scales. Capitals, the current or
 * selected city, offices and route waypoints are supplied in `protectedCityIds`,
 * so they always keep an independent marker. `clusterGroup` can keep rival
 * factions in separate seals even when their border cities are geographically
 * close. A bounded, centroid-based group is used instead of an unbounded
 * connected component: a chain of neighbouring Jiangnan cities can no longer
 * collapse half a province into one enormous seal.
 */
export function layoutCityMarkerClusters(
  cities: readonly CityDefinition[],
  protectedCityIds: ReadonlySet<string>,
  detail: MapDetail,
  clusterGroup: (city: CityDefinition) => string = () => "all",
): CityMarkerCluster[] {
  const compact = cities
    .filter((city) => !protectedCityIds.has(city.id))
    .sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
  const threshold = CLUSTER_DISTANCE[detail];
  const visited = new Set<string>();
  const groups: CityDefinition[][] = [];

  for (const seed of compact) {
    if (visited.has(seed.id)) continue;
    const group: CityDefinition[] = [seed];
    visited.add(seed.id);
    if (threshold > 0) {
      const candidates = compact
        .filter((candidate) => !visited.has(candidate.id) && clusterGroup(candidate) === clusterGroup(seed))
        .sort((a, b) => Math.hypot(a.x - seed.x, a.y - seed.y) - Math.hypot(b.x - seed.x, b.y - seed.y) || a.id.localeCompare(b.id));
      for (const candidate of candidates) {
        if (group.length >= MAX_CLUSTER_SIZE[detail]) break;
        const centerX = group.reduce((sum, city) => sum + city.x, 0) / group.length;
        const centerY = group.reduce((sum, city) => sum + city.y, 0) / group.length;
        const nearSeed = Math.hypot(candidate.x - seed.x, candidate.y - seed.y) < threshold;
        const nearCenter = Math.hypot(candidate.x - centerX, candidate.y - centerY) < threshold * .82;
        const compactSpan = group.every((city) => Math.hypot(candidate.x - city.x, candidate.y - city.y) < threshold * 1.35);
        if (!nearSeed || !nearCenter || !compactSpan) continue;
        group.push(candidate);
        visited.add(candidate.id);
      }
    }
    groups.push(group);
  }

  return groups.map((group) => {
    const ordered = [...group].sort((a, b) => cityPriority(b) - cityPriority(a) || a.id.localeCompare(b.id));
    const cityIds = ordered.map((city) => city.id);
    return {
      id: cityIds.join("+"),
      cityIds,
      primaryCityId: ordered[0].id,
      x: group.reduce((sum, city) => sum + city.x, 0) / group.length,
      y: group.reduce((sum, city) => sum + city.y, 0) / group.length,
      radius: CLUSTER_RADIUS[detail] + (group.length > 1 ? Math.min(2.2, Math.log2(group.length + 1)) : 0),
    };
  });
}
