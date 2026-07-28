import { describe, expect, it } from "vitest";
import { routeBusinessInsights } from "../src/core/routeBusiness";
import type { BusinessRecord, RouteDefinition, RouteIntelState } from "../src/core/types";

const route = (id: string): RouteDefinition => ({ id, from: "linan", to: "huzhou", name: id, terrain: "official", days: 2, danger: 20, note: "" });
const intel = (trips: number): RouteIntelState => ({ surveyedDay: 4, knownDanger: 20, trips, knownCondition: "clear" });

function record(id: string, routeIds: string[], netChange: number, closedDay: number, outcome: BusinessRecord["outcome"] = "delivery"): BusinessRecord {
  return {
    id,
    contractId: `contract-${id}`,
    title: `第${id}号镖`,
    contractKind: "cargo",
    fromCityId: "linan",
    toCityId: "huzhou",
    startedDay: 1,
    closedDay,
    durationDays: Math.max(1, closedDay - 1),
    routeIds,
    grade: outcome === "delivery" ? "甲" : "转",
    outcome,
    cargoIntegrity: 100,
    sealIntact: true,
    battlesWon: 0,
    finance: { openingSilver: 100, enRouteCashChange: -10, grossReward: 70, crewWages: 10, contractReward: 60, tradeRevenue: 0, compensation: 0, closingSilver: 100 + netChange, netChange },
  };
}

describe("商路经营图层", () => {
  it("按一趟镖实际经过的独立路段均摊净银，并区分盈亏与未走路线", () => {
    const routes = [route("r1"), route("r2"), route("r3")];
    const insights = routeBusinessInsights(routes, { r1: intel(3), r2: intel(2), r3: intel(0) }, [
      record("a", ["r1", "r2", "r2"], 60, 5),
      record("b", ["r2"], -80, 8, "transfer"),
    ]);

    expect(insights.r1).toMatchObject({ trips: 3, ledgerTrips: 1, deliveredTrips: 1, allocatedNet: 30, averageAllocatedNet: 30, tone: "profit", seal: "盈" });
    expect(insights.r2).toMatchObject({ trips: 2, ledgerTrips: 2, deliveredTrips: 1, allocatedNet: -50, averageAllocatedNet: -25, tone: "loss", seal: "亏", lastClosedDay: 8, lastTitle: "第b号镖" });
    expect(insights.r3).toMatchObject({ trips: 0, ledgerTrips: 0, tone: "untraveled", seal: "未", masteryLabel: "尚未亲走" });
  });

  it("走过但尚未形成完整账页的路线仍作为熟路显示", () => {
    const insights = routeBusinessInsights([route("known")], { known: intel(4) }, []);
    expect(insights.known).toMatchObject({ tone: "known", seal: "熟", masteryLabel: "老路成谱", allocatedNet: 0 });
    expect(insights.known.summary).toContain("已经走过 4 趟");
  });

  it("忽略失效路线并以收卷日选择最近一笔镖程", () => {
    const insights = routeBusinessInsights([route("r1")], { r1: intel(1) }, [
      record("newer", ["r1", "missing"], 12, 10),
      record("older", ["r1"], 8, 6),
    ]);
    expect(insights.r1).toMatchObject({ ledgerTrips: 2, allocatedNet: 20, lastClosedDay: 10, lastTitle: "第newer号镖" });
  });
});
