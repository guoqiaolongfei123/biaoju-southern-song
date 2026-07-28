import { describe, expect, it } from "vitest";
import { ROUTES } from "../src/core/data";
import {
  ROUTE_LANDMARKS,
  landmarksForPlan,
  landmarksForRoute,
  primaryLandmarkForRoute,
  routeLandmarkKind,
} from "../src/core/routeLandmarkContent";
import { layoutRouteLandmarks, type RouteLandmarkPoint } from "../src/map/routeLandmarkLayout";

describe("沿途关渡与驿寨内容", () => {
  it("每处路标都锚定现有路线，并留在路段中部", () => {
    const routeIds = new Set(ROUTES.map((route) => route.id));
    expect(ROUTE_LANDMARKS.length).toBeGreaterThanOrEqual(30);
    expect(ROUTE_LANDMARKS.filter((landmark) => !routeIds.has(landmark.routeId))).toEqual([]);
    for (const landmark of ROUTE_LANDMARKS) {
      expect(landmark.progress).toBeGreaterThanOrEqual(.15);
      expect(landmark.progress).toBeLessThanOrEqual(.85);
      expect(routeLandmarkKind(landmark.kind).seal.length).toBe(1);
    }
  });

  it("名关名渡可按路线和行程顺序查询", () => {
    expect(primaryLandmarkForRoute("datong-taiyuan")?.name).toBe("雁门关");
    expect(primaryLandmarkForRoute("yangzhou-zhenjiang")?.name).toBe("瓜洲渡");
    expect(landmarksForRoute("lizhou-xingyuan").map((landmark) => landmark.name)).toEqual(["剑门关"]);
    expect(landmarksForPlan(["datong-taiyuan", "zhending-taiyuan"]).map((landmark) => landmark.name)).toEqual(["雁门关", "井陉关"]);
  });

  it("相邻路标会合标，当前路线的路标优先成为主标", () => {
    const points: RouteLandmarkPoint[] = [
      { id: "local", kind: "post", prominence: "local", pinned: false, x: 100, y: 100 },
      { id: "active", kind: "ferry", prominence: "major", pinned: true, x: 104, y: 101 },
    ];
    const layout = layoutRouteLandmarks(points, [], "close");
    expect(layout).toHaveLength(1);
    expect(layout[0].landmarkIds).toEqual(["active", "local"]);
    expect(layout[0].primaryLandmarkId).toBe("active");
    expect(layout[0].pinned).toBe(true);
  });

  it("路标会稳定避开城楼占位，重复布局不会跳动", () => {
    const points: RouteLandmarkPoint[] = [
      { id: "pass-a", kind: "pass", prominence: "major", pinned: false, x: 100, y: 100 },
      { id: "post-b", kind: "post", prominence: "major", pinned: false, x: 104, y: 102 },
    ];
    const obstacles = [{ id: "city", x: 100, y: 100, radius: 8 }];
    const first = layoutRouteLandmarks(points, obstacles, "wide");
    const second = layoutRouteLandmarks(points, obstacles, "wide");
    expect(first).toEqual(second);
    expect(Math.hypot(first[0].x - 100, first[0].y - 100)).toBeGreaterThan(10);
  });
});
