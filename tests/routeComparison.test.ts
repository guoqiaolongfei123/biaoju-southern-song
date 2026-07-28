import { describe, expect, it } from "vitest";
import {
  routeCandidateAnchorRouteId,
  routeCandidateBusinessCaption,
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

const businessCandidate = (business?: MapRouteCandidate["business"]): MapRouteCandidate => ({
  ...candidates[0],
  business,
});

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

  it("summarizes only covered route business on compact map slips", () => {
    expect(routeCandidateBusinessCaption(businessCandidate())).toBe("旧账未载");
    expect(routeCandidateBusinessCaption(businessCandidate({
      tone: "profit",
      seal: "盈",
      label: "旧路有盈",
      coverageLabel: "三段有账",
      apportionedNet: 85,
      familiarSegments: 3,
      ledgerSegments: 3,
      segmentCount: 4,
    }))).toBe("账3/4 · +85两");
    expect(routeCandidateBusinessCaption(businessCandidate({
      tone: "loss",
      seal: "亏",
      label: "旧路有亏",
      coverageLabel: "一段有账",
      apportionedNet: -12,
      familiarSegments: 1,
      ledgerSegments: 1,
      segmentCount: 2,
    }))).toBe("账1/2 · -12两");
  });

  it("distinguishes familiar unclosed roads from completely new roads", () => {
    expect(routeCandidateBusinessCaption(businessCandidate({
      tone: "known",
      seal: "熟",
      label: "旧路未结",
      coverageLabel: "两段走过",
      apportionedNet: 0,
      familiarSegments: 2,
      ledgerSegments: 0,
      segmentCount: 5,
    }))).toBe("熟2/5 · 未结");
    expect(routeCandidateBusinessCaption(businessCandidate({
      tone: "known",
      seal: "新",
      label: "尚无旧账",
      coverageLabel: "全程新路",
      apportionedNet: 0,
      familiarSegments: 0,
      ledgerSegments: 0,
      segmentCount: 3,
    }))).toBe("新路 · 无旧账");
  });
});
