export interface MapRouteCandidate {
  id: string;
  label: string;
  routeIds: string[];
  cityIds: string[];
  days: number;
  dangerLabel: string;
  borderSegments: number;
}

export const ROUTE_CANDIDATE_SEALS = ["壹", "贰", "叁"] as const;

export function routeCandidateSeal(index: number): string {
  return ROUTE_CANDIDATE_SEALS[index] ?? String(index + 1);
}

export function routeCandidateMembership(candidates: MapRouteCandidate[]): Map<string, number[]> {
  const membership = new Map<string, number[]>();
  candidates.forEach((candidate, candidateIndex) => {
    candidate.routeIds.forEach((routeId) => {
      const members = membership.get(routeId) ?? [];
      if (!members.includes(candidateIndex)) members.push(candidateIndex);
      membership.set(routeId, members);
    });
  });
  return membership;
}

/**
 * Pick a route segment for the numbered map seal. A segment unique to the
 * candidate is preferred; ties favour the middle of the journey so the seal
 * stays visually associated with the whole route rather than an endpoint.
 */
export function routeCandidateAnchorRouteId(candidate: MapRouteCandidate, candidates: MapRouteCandidate[]): string | null {
  if (candidate.routeIds.length === 0) return null;
  const membership = routeCandidateMembership(candidates);
  const middle = (candidate.routeIds.length - 1) / 2;
  return candidate.routeIds.reduce((bestId, routeId, routeIndex) => {
    const bestIndex = candidate.routeIds.indexOf(bestId);
    const routeScore = (membership.get(routeId)?.length ?? candidates.length) * 100 + Math.abs(routeIndex - middle);
    const bestScore = (membership.get(bestId)?.length ?? candidates.length) * 100 + Math.abs(bestIndex - middle);
    return routeScore < bestScore ? routeId : bestId;
  }, candidate.routeIds[0]);
}

export function routeCandidateCityRole(candidate: MapRouteCandidate, cityId: string): "origin" | "stopover" | "destination" | null {
  const index = candidate.cityIds.indexOf(cityId);
  if (index < 0) return null;
  if (index === 0) return "origin";
  if (index === candidate.cityIds.length - 1) return "destination";
  return "stopover";
}
