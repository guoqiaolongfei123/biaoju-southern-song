import { describe, expect, it } from "vitest";
import {
  routeCandidateAnchorRouteId,
  routeCandidateCityRole,
  routeCandidateMembership,
  routeCandidateSeal,
  type MapRouteCandidate,
} from "../src/map/routeComparison";

const candidates: MapRouteCandidate[] = [
  { id: "north", label: "北道", routeIds: ["shared", "north-only", "last"], cityIds: ["a", "b", "d"], days: 6, dangerLabel: "中", borderSegments: 1 },
  { id: "south", label: "南道", routeIds: ["shared", "south-only", "last"], cityIds: ["a", "c", "d"], days: 7, dangerLabel: "低", borderSegments: 0 },
  { id: "direct", label: "直道", routeIds: ["shared", "last"], cityIds: ["a", "d"], days: 5, dangerLabel: "高", borderSegments: 2 },
];

describe("map route comparison", () => {
  it("records every candidate that shares a physical route segment", () => {
    const membership = routeCandidateMembership(candidates);
    expect(membership.get("shared")).toEqual([0, 1, 2]);
    expect(membership.get("north-only")).toEqual([0]);
  });

  it("places each route seal on a distinctive segment when one exists", () => {
    expect(routeCandidateAnchorRouteId(candidates[0], candidates)).toBe("north-only");
    expect(routeCandidateAnchorRouteId(candidates[1], candidates)).toBe("south-only");
  });

  it("classifies endpoints and stopovers for map waypoint seals", () => {
    expect(routeCandidateCityRole(candidates[0], "a")).toBe("origin");
    expect(routeCandidateCityRole(candidates[0], "b")).toBe("stopover");
    expect(routeCandidateCityRole(candidates[0], "d")).toBe("destination");
    expect(routeCandidateCityRole(candidates[0], "x")).toBeNull();
  });

  it("uses readable financial-style numerals for the first three plans", () => {
    expect([0, 1, 2, 3].map(routeCandidateSeal)).toEqual(["壹", "贰", "叁", "4"]);
  });
});
