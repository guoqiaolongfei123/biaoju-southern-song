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

const CLUSTER_DISTANCE: Record<MapDetail, number> = { wide: 19, mid: 9, close: 0 };
const CLUSTER_RADIUS: Record<MapDetail, number> = { wide: 7.8, mid: 5.6, close: 3.2 };

function cityPriority(city: CityDefinition): number {
  return city.tier === "capital" ? 3 : city.tier === "major" ? 2 : 1;
}

/**
 * Groups nearby settlement marks at overview scales. Capitals, the current or
 * selected city, offices and route waypoints are supplied in `protectedCityIds`,
 * so they always keep an independent marker. `clusterGroup` can keep rival
 * factions in separate seals even when their border cities are geographically
 * close. Overview groups are connected components rather than paint-order
 * buckets, making the result stable when source data changes.
 */
export function layoutCityMarkerClusters(
  cities: readonly CityDefinition[],
  protectedCityIds: ReadonlySet<string>,
  detail: MapDetail,
  clusterGroup: (city: CityDefinition) => string = () => "all",
): CityMarkerCluster[] {
  const compact = cities
    .filter((city) => !protectedCityIds.has(city.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const threshold = CLUSTER_DISTANCE[detail];
  const visited = new Set<string>();
  const groups: CityDefinition[][] = [];

  for (const seed of compact) {
    if (visited.has(seed.id)) continue;
    const group: CityDefinition[] = [];
    const queue = [seed];
    visited.add(seed.id);
    while (queue.length) {
      const current = queue.shift()!;
      group.push(current);
      if (threshold <= 0) continue;
      for (const candidate of compact) {
        if (visited.has(candidate.id)) continue;
        if (clusterGroup(candidate) !== clusterGroup(current)) continue;
        if (Math.hypot(candidate.x - current.x, candidate.y - current.y) >= threshold) continue;
        visited.add(candidate.id);
        queue.push(candidate);
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
