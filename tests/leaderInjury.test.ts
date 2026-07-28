import { describe, expect, it } from "vitest";
import { battleResult, createBattleSimulation } from "../src/battle/simulation";
import { acceptContract, applyBattleResult, chooseRoute, createInitialGame, generateRoutePlans, investigateRoute, leaderBattleProfile, purchaseService, segmentTravelForecast } from "../src/core/game";
import { createCrewInjury } from "../src/core/injuryContent";
import { migrateSavedGame } from "../src/core/save";
import type { BattleConfig, BattleResult } from "../src/core/types";

const BATTLE_CONFIG: BattleConfig = {
  id: "leader-injury-test",
  seed: 218,
  terrain: "official",
  danger: 58,
  objective: "护车突围",
  enemyFaction: "剪径客",
  routeName: "临安北道",
  guards: [{ id: "guard-a", name: "鲁沧", role: "副镖头", healthRatio: 1, power: 1.2 }],
};

describe("protagonist persistent injuries", () => {
  it("derives a lasting protagonist injury from heavy battle damage", () => {
    const battle = createBattleSimulation(BATTLE_CONFIG);
    battle.player.hp = battle.player.maxHp * .52;
    const result = battleResult(battle);
    expect(result.leaderDamage).toBe(48);
    expect(["fracture", "internal-trauma"]).toContain(result.leaderInjury);
  });

  it("applies injury penalties to the next battle and route forecast", () => {
    const healthy = createInitialGame(219);
    const injured = { ...healthy, leader: { ...healthy.leader, injury: createCrewInjury("fracture", healthy.day) } };
    const healthyProfile = leaderBattleProfile(healthy);
    const injuredProfile = leaderBattleProfile(injured);
    const routeId = generateRoutePlans(healthy.currentCityId, healthy.contracts[0].to, healthy)[0].routeIds[0];
    expect(injuredProfile.power).toBeLessThan(healthyProfile.power);
    expect(injuredProfile.armorMultiplier ?? 1).toBeGreaterThan(healthyProfile.armorMultiplier ?? 1);
    expect(injuredProfile.movementMultiplier).toBe(.68);
    expect(injuredProfile.techniqueCooldownMultiplier).toBe(1.28);
    expect(segmentTravelForecast(injured, routeId).days).toBe(segmentTravelForecast(healthy, routeId).days + 1);
  });

  it("writes the protagonist injury into campaign state and the battle report", () => {
    const game = createInitialGame(220);
    const planning = acceptContract(game, game.contracts[0].id);
    const plan = generateRoutePlans(planning.journey!.contract.from, planning.journey!.contract.to, planning)[0];
    const traveling = chooseRoute(planning, plan);
    const result: BattleResult = {
      outcome: "complete",
      elapsedHours: 3,
      leaderDamage: 42,
      leaderInjury: "fracture",
      guardLoss: 0,
      cartDamage: 0,
      cargoLoss: 0,
      sealBroken: false,
      guardDamage: {},
    };
    const next = applyBattleResult({ ...traveling, phase: "battle", pendingBattle: BATTLE_CONFIG }, result);
    expect(next.leader.injury).toMatchObject({ id: "fracture", remainingDays: 7, acquiredDay: game.day });
    expect(next.convoy.leaderHp).toBe(58);
    expect(next.news.some((item) => item.includes(game.leader.name) && item.includes("骨伤难行"))).toBe(true);
  });

  it("recovers protagonist injuries through elapsed days and city treatment", () => {
    const game = createInitialGame(221);
    const planning = acceptContract({ ...game, leader: { ...game.leader, injury: createCrewInjury("fracture", game.day) } }, game.contracts[0].id);
    const plan = generateRoutePlans(planning.journey!.contract.from, planning.journey!.contract.to, planning)[0];
    const staleIntel = Object.fromEntries(Object.entries(planning.routeIntel).map(([id, intel]) => [id, plan.routeIds.includes(id) ? { ...intel, surveyedDay: -99 } : intel]));
    const scouted = investigateRoute({ ...planning, routeIntel: staleIntel }, plan, "scout");
    expect(scouted.day).toBe(game.day + 1);
    expect(scouted.leader.injury?.remainingDays).toBe(6);

    const bladeWound = { ...game, silver: 999, leader: { ...game.leader, injury: createCrewInjury("blade-wound", game.day) } };
    const treated = purchaseService(bladeWound, "heal");
    expect(treated.leader.injury).toBeNull();
    expect(treated.news[0]).toContain(game.leader.name);
  });

  it("migrates older saves without protagonist injury data safely", () => {
    const legacy = createInitialGame(222) as unknown as Record<string, unknown>;
    const leader = { ...(legacy.leader as Record<string, unknown>) };
    delete leader.injury;
    const migrated = migrateSavedGame({ ...legacy, leader })!;
    expect(migrated.leader.injury).toBeNull();
  });
});
