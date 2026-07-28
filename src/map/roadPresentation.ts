import type { CityDefinition, RouteDefinition } from "../core/types";

export type MapRoadGrade = "arterial" | "regional" | "local";

export interface MapRoadPresentation {
  grade: MapRoadGrade;
  label: string;
  note: string;
}

const TIER_WEIGHT = { capital: 3, major: 2, station: 1 } as const;

/**
 * Classifies the visual importance of a road without changing its simulation
 * values. Terrain answers "what is it made of"; grade answers "how strongly
 * should it read on a crowded map".
 */
export function mapRoadPresentation(
  route: RouteDefinition,
  from: CityDefinition,
  to: CityDefinition,
): MapRoadPresentation {
  const endpointWeight = TIER_WEIGHT[from.tier] + TIER_WEIGHT[to.tier];
  const touchesCapital = from.tier === "capital" || to.tier === "capital";

  if ((route.terrain === "official" && (touchesCapital || endpointWeight >= 5))
    || (route.terrain === "river" && endpointWeight >= 5 && route.days <= 2)) {
    return { grade: "arterial", label: "天下干道", note: "连接都城与大府的主干驿路，在总览中始终清晰。" };
  }

  if (route.terrain === "official" || endpointWeight >= 4 || route.days <= 2) {
    return { grade: "regional", label: "州府通衢", note: "沟通相邻州府与要津的常行道路。" };
  }

  return { grade: "local", label: "乡驿支路", note: "深入山乡或边地的次级道路，放大后更清楚。" };
}
