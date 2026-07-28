import type { CityState, FactionId, RouteDefinition } from "../core/types";

export interface QuadraticCurve {
  from: { x: number; y: number };
  to: { x: number; y: number };
  control: { x: number; y: number };
}

export interface SplitQuadraticCurve {
  midpoint: { x: number; y: number };
  fromPath: string;
  toPath: string;
}

export function routeCrossesPoliticalBorder(
  cities: Record<string, CityState>,
  route: Pick<RouteDefinition, "from" | "to">,
): boolean {
  const fromOwner = cities[route.from]?.owner;
  const toOwner = cities[route.to]?.owner;
  return Boolean(fromOwner && toOwner && fromOwner !== toOwner);
}

export function politicalBorderCityIds(
  cities: Record<string, CityState>,
  routes: Array<Pick<RouteDefinition, "from" | "to">>,
): Set<string> {
  const result = new Set<string>();
  for (const route of routes) {
    if (!routeCrossesPoliticalBorder(cities, route)) continue;
    result.add(route.from);
    result.add(route.to);
  }
  return result;
}

export function routeOwners(
  cities: Record<string, CityState>,
  route: Pick<RouteDefinition, "from" | "to">,
): { from: FactionId; to: FactionId } {
  return {
    from: cities[route.from]?.owner ?? "neutral",
    to: cities[route.to]?.owner ?? "neutral",
  };
}

export function splitQuadraticCurve(curve: QuadraticCurve): SplitQuadraticCurve {
  const fromControl = {
    x: (curve.from.x + curve.control.x) / 2,
    y: (curve.from.y + curve.control.y) / 2,
  };
  const toControl = {
    x: (curve.control.x + curve.to.x) / 2,
    y: (curve.control.y + curve.to.y) / 2,
  };
  const midpoint = {
    x: (fromControl.x + toControl.x) / 2,
    y: (fromControl.y + toControl.y) / 2,
  };
  return {
    midpoint,
    fromPath: `M ${curve.from.x} ${curve.from.y} Q ${fromControl.x} ${fromControl.y} ${midpoint.x} ${midpoint.y}`,
    toPath: `M ${midpoint.x} ${midpoint.y} Q ${toControl.x} ${toControl.y} ${curve.to.x} ${curve.to.y}`,
  };
}
