import { describe, expect, it } from "vitest";
import { appendBusinessRecord, BUSINESS_LEDGER_LIMIT, businessLedgerSummary, createBusinessRecord, normalizeBusinessLedger } from "../src/core/businessLedger";
import { acceptContract, createInitialGame } from "../src/core/game";
import { CITIES, ROUTES } from "../src/core/data";
import { migrateSavedGame } from "../src/core/save";
import type { BusinessRecord, Settlement } from "../src/core/types";

function record(id: string, netChange: number, outcome: BusinessRecord["outcome"] = "delivery"): BusinessRecord {
  return {
    id,
    contractId: `contract-${id}`,
    title: `第${id}号镖`,
    contractKind: "cargo",
    fromCityId: "linan",
    toCityId: "huzhou",
    startedDay: 1,
    closedDay: 3,
    durationDays: 2,
    routeIds: ["huzhou-linan"],
    grade: outcome === "delivery" ? "甲" : "转",
    outcome,
    cargoIntegrity: 100,
    sealIntact: true,
    battlesWon: 0,
    finance: { openingSilver: 100, enRouteCashChange: -10, grossReward: 90, crewWages: 20, contractReward: 70, tradeRevenue: 0, compensation: 0, closingSilver: 100 + netChange, netChange },
  };
}

describe("柜上总账", () => {
  it("从实际行程与收支快照生成可追溯记录", () => {
    const planning = acceptContract(createInitialGame(1107), "opening-xiangyang");
    const settlement: Settlement = {
      grade: "乙", outcome: "delivery", title: "依约入城", summary: "交割。", reward: 80, compensation: 0, reputationChange: 4, notes: [],
      finance: { openingSilver: 120, enRouteCashChange: -18, grossReward: 105, crewWages: 25, contractReward: 80, tradeRevenue: 22, compensation: 0, closingSilver: 204, netChange: 84 },
    };
    const journey = { ...planning.journey!, traveledRouteIds: [planning.journey!.plan.routeIds[0]], battleVictories: 1 };
    const result = createBusinessRecord(journey, settlement, 6, 83, false)!;
    expect(result).toMatchObject({ contractId: "opening-xiangyang", startedDay: 1, closedDay: 6, durationDays: 5, grade: "乙", outcome: "delivery", cargoIntegrity: 83, sealIntact: false, battlesWon: 1 });
    expect(result.finance.netChange).toBe(84);
  });

  it("只保留最近十二趟并按编号去重", () => {
    let records: BusinessRecord[] = [];
    for (let index = 0; index < BUSINESS_LEDGER_LIMIT + 3; index += 1) records = appendBusinessRecord(records, record(`${index}`, index));
    expect(records).toHaveLength(BUSINESS_LEDGER_LIMIT);
    expect(records[0].id).toBe(`${BUSINESS_LEDGER_LIMIT + 2}`);
    expect(appendBusinessRecord(records, { ...records[4], finance: { ...records[4].finance, netChange: 99 } })).toHaveLength(BUSINESS_LEDGER_LIMIT);
  });

  it("汇总交割率、盈利趟数、平均净银与最佳镖程", () => {
    const summary = businessLedgerSummary([record("a", 60), record("b", -30, "transfer"), record("c", 15)]);
    expect(summary).toMatchObject({ completed: 3, delivered: 2, profitable: 2, totalNet: 45, averageNet: 15, totalDays: 6 });
    expect(summary.bestRecord?.id).toBe("a");
  });

  it("迁移时剔除失效城路并以首尾现银重算净额", () => {
    const source = { ...record("old", 999), routeIds: ["huzhou-linan", "missing-road"], finance: { ...record("old", 0).finance, openingSilver: 120, closingSilver: 150, netChange: 999 } };
    const normalized = normalizeBusinessLedger([source], new Set(CITIES.map((city) => city.id)), new Set(ROUTES.map((route) => route.id)));
    expect(normalized[0].routeIds).toEqual(["huzhou-linan"]);
    expect(normalized[0].finance.netChange).toBe(30);
  });

  it("旧存档补齐空账簿，并为尚未收卷的结算补记当前一趟", () => {
    const emptyOld = { ...createInitialGame(1107), version: 25 } as unknown as Record<string, unknown>;
    delete emptyOld.businessLedger;
    const emptyMigrated = migrateSavedGame(emptyOld)!;
    expect(emptyMigrated.version).toBe(26);
    expect(emptyMigrated.businessLedger).toEqual([]);

    const planning = acceptContract(createInitialGame(1107), "opening-xiangyang");
    const settlement: Settlement = {
      grade: "乙", outcome: "delivery", title: "旧档交割", summary: "交割。", reward: 70, compensation: 0, reputationChange: 3, notes: [],
      finance: { openingSilver: 120, enRouteCashChange: -10, grossReward: 95, crewWages: 25, contractReward: 70, tradeRevenue: 0, compensation: 0, closingSilver: 180, netChange: 60 },
    };
    const settlingOld = { ...planning, version: 25, phase: "settlement", settlement } as unknown as Record<string, unknown>;
    delete settlingOld.businessLedger;
    const settlingMigrated = migrateSavedGame(settlingOld)!;
    expect(settlingMigrated.businessLedger).toHaveLength(1);
    expect(settlingMigrated.businessLedger[0]).toMatchObject({ contractId: "opening-xiangyang", outcome: "delivery", finance: { netChange: 60 } });
  });
});
