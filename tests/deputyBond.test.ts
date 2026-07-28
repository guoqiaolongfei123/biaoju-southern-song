import { describe, expect, it } from "vitest";
import { battleCoreComboTuning, battleResult, createBattleSimulation } from "../src/battle/simulation";
import { deputyBondGain, deputyBondRank } from "../src/core/deputyBondContent";
import { acceptContract, applyBattleResult, chooseRoute, createInitialGame, generateRoutePlans, leaderBattleProfile } from "../src/core/game";
import { migrateSavedGame } from "../src/core/save";
import type { BattleConfig, BattleResult } from "../src/core/types";

const BOND_CONFIG: BattleConfig = {
  id: "deputy-bond-test",
  seed: 913,
  terrain: "official",
  danger: 58,
  objective: "护车破阵",
  enemyFaction: "剪径客",
  routeName: "临安北道",
  leader: { name: "沈砺", experience: 9, healthRatio: 1, power: 1.3, deputyBond: 7 },
  guards: [{ id: "lu-cang", name: "鲁沧", role: "副镖头", experience: 10, healthRatio: 1, power: 1.3 }],
};

describe("protagonist and deputy bond progression", () => {
  it("turns persistent bond ranks into stronger and faster core combos", () => {
    const unfamiliar = battleCoreComboTuning(9, 10, 0);
    const sworn = battleCoreComboTuning(9, 10, 12);
    expect(deputyBondRank(12).label).toBe("托命");
    expect(sworn.damageMultiplier).toBeGreaterThan(unfamiliar.damageMultiplier);
    expect(sworn.cooldownSeconds).toBeLessThan(unfamiliar.cooldownSeconds);
  });

  it("awards more bond experience when the pair repeatedly completes automatic combos", () => {
    expect(deputyBondGain(0)).toBe(1);
    expect(deputyBondGain(1)).toBe(2);
    expect(deputyBondGain(3)).toBe(3);
    const battle = createBattleSimulation(BOND_CONFIG);
    battle.coreComboCount = 3;
    expect(battleResult(battle)).toMatchObject({ leaderDeputyId: "lu-cang", leaderDeputyCombos: 3, leaderDeputyBondGain: 3 });
  });

  it("passes the selected deputy's bond into the next battle profile", () => {
    const game = createInitialGame(914);
    const bonded = { ...game, leader: { ...game.leader, deputyBonds: { "lu-cang": 7 } } };
    expect(leaderBattleProfile(bonded).deputyBond).toBe(7);
  });

  it("stores battle-earned bond separately for each deputy and reports a rank-up", () => {
    const game = createInitialGame(915);
    const planning = acceptContract({ ...game, leader: { ...game.leader, deputyBonds: { "lu-cang": 2 } } }, game.contracts[0].id);
    const plan = generateRoutePlans(planning.journey!.contract.from, planning.journey!.contract.to, planning)[0];
    const traveling = chooseRoute(planning, plan);
    const result: BattleResult = {
      outcome: "complete", elapsedHours: 3, leaderDamage: 0, leaderDeputyId: "lu-cang", leaderDeputyCombos: 1, leaderDeputyBondGain: 2,
      guardLoss: 0, cartDamage: 0, cargoLoss: 0, sealBroken: false, guardDamage: {},
    };
    const next = applyBattleResult({ ...traveling, phase: "battle", pendingBattle: BOND_CONFIG }, result);
    expect(next.leader.deputyBonds["lu-cang"]).toBe(4);
    expect(next.news.some((item) => item.includes("主副默契") && item.includes("相知"))).toBe(true);
  });

  it("migrates older saves without deputy bond data safely", () => {
    const legacy = createInitialGame(916) as unknown as Record<string, unknown>;
    const leader = { ...(legacy.leader as Record<string, unknown>) };
    delete leader.deputyBonds;
    const migrated = migrateSavedGame({ ...legacy, leader })!;
    expect(migrated.leader.deputyBonds).toEqual({});
  });
});
