import type { RoutePlanBusinessTone } from "../core/routeBusiness";

export interface MapRouteBusinessReference {
  tone: RoutePlanBusinessTone;
  seal: string;
  label: string;
  coverageLabel: string;
  apportionedNet: number;
  familiarSegments: number;
  ledgerSegments: number;
  segmentCount: number;
}

export interface MapRouteCandidate {
  id: string;
  label: string;
  routeIds: string[];
  cityIds: string[];
  days: number;
  dangerLabel: string;
  borderSegments: number;
  weatherLabel?: string;
  business?: MapRouteBusinessReference;
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

/** A compact, honest map-slip caption; it never labels uncovered segments as profitable. */
export function routeCandidateBusinessCaption(candidate: MapRouteCandidate): string {
  const business = candidate.business;
  if (!business) return "旧账未载";
  if (business.ledgerSegments > 0) return `账${business.ledgerSegments}/${business.segmentCount} · ${business.apportionedNet >= 0 ? "+" : ""}${business.apportionedNet}两`;
  if (business.familiarSegments > 0) return `熟${business.familiarSegments}/${business.segmentCount} · 未结`;
  return "新路 · 无旧账";
}
