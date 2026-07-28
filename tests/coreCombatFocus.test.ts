import { describe, expect, it } from "vitest";
import { battleCoreComboTuning, battleCoreCounterTuning, battleResult, createBattleSimulation } from "../src/battle/simulation";
import { coreCombatExperienceGain, coreCombatFocusTuning } from "../src/core/coreCombatFocusContent";
import { acceptContract, applyBattleResult, chooseRoute, createInitialGame, generateRoutePlans, leaderBattleProfile, setCoreCombatFocus } from "../src/core/game";
import { migrateSavedGame } from "../src/core/save";
import type { BattleConfig, BattleResult } from "../src/core/types";

const CORE_CONFIG: BattleConfig = {
  id: "core-focus-test",
  seed: 2207,
  terrain: "official",
  danger: 58,
  objective: "护车破阵",
  enemyFaction: "剪径客",
  routeName: "临安北道",
  leader: {
    name: "沈砺",
    experience: 9,
    healthRatio: 1,
    power: 1.3,
    deputyBond: 7,
    coreCombatFocusId: "paired-assault",
    coreCombatExperience: 10,
  },
  guards: [{ id: "lu-cang", name: "鲁沧", role: "副镖头", experience: 10, healthRatio: 1, power: 1.3 }],
};

describe("protagonist and deputy core combat focuses", () => {
  it("keeps three independently growing paths with distinct automatic battle effects", () => {
    const pairedNovice = battleCoreComboTuning(9, 10, 7, "paired-assault", 0);
    const pairedMaster = battleCoreComboTuning(9, 10, 7, "paired-assault", 18);
    expect(pairedMaster.damageMultiplier).toBeGreaterThan(pairedNovice.damageMultiplier);
    expect(pairedMaster.cooldownSeconds).toBeLessThan(pairedNovice.cooldownSeconds);
    expect(pairedMaster.assistRange).toBeGreaterThan(pairedNovice.assistRange);

    const guardNovice = battleCoreCounterTuning(9, 10, 7, "cross-guard", 0);
    const guardMaster = battleCoreCounterTuning(9, 10, 7, "cross-guard", 18);
    expect(guardMaster.incomingMultiplier).toBeLessThan(guardNovice.incomingMultiplier);
    expect(guardMaster.damageMultiplier).toBeGreaterThan(guardNovice.damageMultiplier);
    expect(guardMaster.stunSeconds).toBeGreaterThan(guardNovice.stunSeconds);

    const hunter = coreCombatFocusTuning("leader-hunt", 18);
    expect(hunter.eliteDamageMultiplier).toBeGreaterThan(1.2);
    expect(hunter.elitePriorityBonus).toBe(150);
    expect(hunter.techniqueCooldownMultiplier).toBeLessThan(.9);
  });

  it("lets the player set a long-term focus before departure and passes it into battle", () => {
    const game = createInitialGame(2208);
    const focused = setCoreCombatFocus(game, "leader-hunt");
    expect(focused.leader.coreCombatFocusId).toBe("leader-hunt");
    expect(leaderBattleProfile(focused)).toMatchObject({ coreCombatFocusId: "leader-hunt", coreCombatExperience: 0 });
    const onRoad = { ...focused, phase: "travel" as const };
    expect(setCoreCombatFocus(onRoad, "cross-guard")).toBe(onRoad);
  });

  it("awards the active path from the automatic actions it trains", () => {
    expect(coreCombatExperienceGain("paired-assault", { combos: 3 })).toBe(3);
    expect(coreCombatExperienceGain("cross-guard", { counters: 2 })).toBe(3);
    expect(coreCombatExperienceGain("leader-hunt", { leaderDefeats: 2, leaderDefeated: true })).toBe(3);

    const battle = createBattleSimulation(CORE_CONFIG);
    battle.coreComboCount = 3;
    expect(battleResult(battle).leaderCoreCombatExperience).toEqual({ "paired-assault": 3 });
  });

  it("persists earned focus experience and reports it after battle", () => {
    let game = setCoreCombatFocus(createInitialGame(2210), "cross-guard");
    game = acceptContract(game, game.contracts[0].id);
    game = chooseRoute(game, generateRoutePlans(game.journey!.contract.from, game.journey!.contract.to, game)[0]);
    const result: BattleResult = {
      outcome: "complete",
      elapsedHours: 3,
      leaderDamage: 0,
      leaderCoreCombatExperience: { "cross-guard": 3 },
      guardLoss: 0,
      cartDamage: 0,
      cargoLoss: 0,
      sealBroken: false,
      guardDamage: {},
    };
    const next = applyBattleResult({ ...game, phase: "battle", pendingBattle: { ...CORE_CONFIG, leader: { ...CORE_CONFIG.leader!, coreCombatFocusId: "cross-guard", coreCombatExperience: 0 } } }, result);
    expect(next.leader.coreCombatExperience["cross-guard"]).toBe(3);
    expect(next.news.some((item) => item.includes("双核心武路") && item.includes("交锋截阵 +3"))).toBe(true);
  });

  it("fills the new progression safely when loading an older save", () => {
    const legacy = createInitialGame(2209) as unknown as Record<string, unknown>;
    const leader = { ...(legacy.leader as Record<string, unknown>) };
    delete leader.coreCombatFocusId;
    delete leader.coreCombatExperience;
    const migrated = migrateSavedGame({ ...legacy, leader })!;
    expect(migrated.leader.coreCombatFocusId).toBe("paired-assault");
    expect(migrated.leader.coreCombatExperience).toEqual({ "paired-assault": 0, "cross-guard": 0, "leader-hunt": 0 });
  });
});
