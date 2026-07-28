import { describe, expect, it } from "vitest";
import { banditTollCost, createInitialGame, generateContracts, recruitCrew } from "../src/core/game";
import { clampJianghuReputation, jianghuRecruitmentCost, jianghuStanding, jianghuStandingProgress } from "../src/core/jianghuContent";
import { migrateSavedGame } from "../src/core/save";

describe("江湖声望", () => {
  it("按旗号阶位提供连续且有上限的长期成长", () => {
    expect(clampJianghuReputation(-8)).toBe(0);
    expect(clampJianghuReputation(131)).toBe(100);
    expect(jianghuStanding(9).label).toBe("无名新号");
    expect(jianghuStanding(25).label).toBe("一路有名");
    expect(jianghuStanding(70).label).toBe("天下识旗");
    expect(jianghuStandingProgress(25)).toEqual({ progress: 0, nextMin: 45, remaining: 20 });
    expect(jianghuStandingProgress(100)).toEqual({ progress: 100, nextMin: null, remaining: 0 });
  });

  it("高声望降低身契与买路银，招募实际按折后价扣银", () => {
    const base = createInitialGame(1107);
    const renowned = { ...base, jianghuReputation: 72, silver: 500 };
    expect(banditTollCost(renowned)).toBeLessThan(banditTollCost(base));
    const candidate = renowned.recruitPool[0];
    const expectedCost = jianghuRecruitmentCost(candidate.hiringCost, renowned.jianghuReputation);
    expect(expectedCost).toBeLessThan(candidate.hiringCost);
    expect(recruitCrew(renowned, candidate.id).silver).toBe(500 - expectedCost);
  });

  it("江湖委托才享受旗号溢价，官府委托不受影响", () => {
    let lowSeed = 1;
    let low = generateContracts("linan", 20, lowSeed, false, 6, undefined, 0, 0, undefined, 0);
    while (!low.contracts.some((contract) => contract.patron === "jianghu") && lowSeed < 100) {
      lowSeed += 1;
      low = generateContracts("linan", 20, lowSeed, false, 6, undefined, 0, 0, undefined, 0);
    }
    const high = generateContracts("linan", 20, lowSeed, false, 6, undefined, 0, 0, undefined, 80);
    for (const contract of low.contracts) {
      const matching = high.contracts.find((item) => item.id === contract.id);
      expect(matching).toBeTruthy();
      if (contract.patron === "jianghu") expect(matching!.reward).toBeGreaterThan(contract.reward);
      else expect(matching!.reward).toBe(contract.reward);
    }
  });

  it("v19 旧档会从原共享声望推定江湖根基并升级到 v20", () => {
    const oldSave = { ...createInitialGame(1107), version: 19 } as unknown as Record<string, unknown>;
    delete oldSave.jianghuReputation;
    const migrated = migrateSavedGame(oldSave);
    expect(migrated?.version).toBe(20);
    expect(migrated?.jianghuReputation).toBe(Math.round(Number(oldSave.reputation) * 0.5));
  });
});
