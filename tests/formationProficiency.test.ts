import { describe, expect, it } from "vitest";
import { autoBattleInput, battleResult, createBattleSimulation, stepBattle } from "../src/battle/simulation";
import { acceptContract, applyBattleResult, chooseRoute, createInitialGame, generateRoutePlans, leaderBattleProfile } from "../src/core/game";
import { formationExperienceAwards, formationProficiencyRank, normalizeFormationExperience } from "../src/core/formationProficiency";
import { migrateSavedGame } from "../src/core/save";
import type { BattleConfig, BattleResult } from "../src/core/types";

const CONFIG: BattleConfig = {
  id: "formation-training",
  seed: 90210,
  terrain: "official",
  danger: 12,
  objective: "守住车阵",
  objectiveMode: "holdout",
  objectiveSeconds: 60,
  enemyFaction: "路匪",
  routeName: "临安官道",
  guards: [{ id: "guard-a", name: "甲", role: "副镖头", healthRatio: 1, power: 1, formationExperience: { advance: 0, hold: 0, horses: 0 } }],
};

describe("formation proficiency", () => {
  it("normalizes old saves and exposes four stable mastery ranks", () => {
    expect(normalizeFormationExperience({ advance: 3.8, hold: -2 })).toEqual({ advance: 3, hold: 0, horses: 0 });
    expect([0, 3, 7, 12].map((experience) => formationProficiencyRank(experience).label)).toEqual(["初识", "熟阵", "善阵", "精阵"]);
    expect(formationProficiencyRank(12).bonus).toBeCloseTo(.09);
  });

  it("awards the main formation and a meaningfully used secondary formation", () => {
    expect(formationExperienceAwards({ advance: 12, hold: 5, horses: 1 })).toEqual({ advance: 1, hold: 1 });
    expect(formationExperienceAwards({ advance: 18, hold: 3.9, horses: 0 })).toEqual({ advance: 1 });
  });

  it("records actual formation time in the simulation and returns it in the debrief result", () => {
    const simulation = createBattleSimulation(CONFIG);
    for (let index = 0; index < 100; index += 1) stepBattle(simulation, autoBattleInput(simulation, "guard-cart"), .05);
    for (let index = 0; index < 80; index += 1) stepBattle(simulation, autoBattleInput(simulation, "guard-horses"), .05);
    const result = battleResult(simulation);
    expect(result.formationSeconds?.hold).toBeCloseTo(5, 1);
    expect(result.formationSeconds?.horses).toBeCloseTo(4, 1);
    expect(result.guardFormationExperience?.["guard-a"]).toEqual({ hold: 2, horses: 1 });
    expect(result.leaderFormationExperience).toEqual({ hold: 2, horses: 1 });
    expect(result.dominantFormation).toBe("hold");
  });

  it("turns formation mastery into stronger automatic execution in the matching formation", () => {
    const damageWithHoldExperience = (hold: number) => {
      const simulation = createBattleSimulation({ ...CONFIG, guards: [{ ...CONFIG.guards[0], role: "趟子手", formationExperience: { advance: 0, hold, horses: 0 } }] });
      simulation.enemies.forEach((enemy, index) => { if (index > 0) enemy.hp = 0; });
      simulation.enemies[0].x = simulation.guards[0].x + 30;
      simulation.enemies[0].y = simulation.guards[0].y;
      simulation.enemies[0].hp = 1000;
      simulation.enemies[0].maxHp = 1000;
      simulation.guards[0].cooldown = 0;
      for (let index = 0; index < 20; index += 1) stepBattle(simulation, autoBattleInput(simulation, "guard-cart"), .05);
      return simulation.guardContributions["guard-a"].damage;
    };
    expect(damageWithHoldExperience(12)).toBeGreaterThan(damageWithHoldExperience(0));
  });

  it("makes the protagonist and deputy the two highest-growth combat roles", () => {
    const simulation = createBattleSimulation({
      ...CONFIG,
      guards: [
        CONFIG.guards[0],
        { ...CONFIG.guards[0], id: "runner", name: "乙", role: "趟子手" },
      ],
    });
    const result = battleResult(simulation);
    expect(result.leaderExperience).toBe(2);
    expect(result.guardExperience?.["guard-a"]).toBe(2);
    expect(result.guardExperience?.runner).toBe(1);
  });

  it("loads the protagonist's own equipment into their battle profile", () => {
    const game = createInitialGame(102);
    const profile = leaderBattleProfile(game);
    expect(profile.name).toBe(game.leader.name);
    expect(profile.power).toBeGreaterThan(1);
    expect(profile.maxHpBonus).toBe(8);
    expect(profile.equipmentNames).toContain("枣木长枪");
  });

  it("adds a protagonist profile when loading a pre-protagonist save", () => {
    const legacy = { ...createInitialGame(103) } as unknown as Record<string, unknown>;
    delete legacy.leader;
    const migrated = migrateSavedGame(legacy)!;
    expect(migrated.leader).toMatchObject({ id: "player-leader", title: "总镖头", experience: 0 });
    expect(migrated.leader.formationExperience).toEqual({ advance: 0, hold: 0, horses: 0 });
  });

  it("writes earned formation experience back to the participating crew member", () => {
    const game = createInitialGame(101);
    const planning = acceptContract(game, game.contracts[0].id);
    const journeyGame = chooseRoute(planning, generateRoutePlans(planning.journey!.contract.from, planning.journey!.contract.to, planning)[0]);
    const member = journeyGame.crew[0];
    const pendingBattle: BattleConfig = { ...CONFIG, guards: [{ ...CONFIG.guards[0], id: member.id, name: member.name }] };
    const result: BattleResult = {
      outcome: "complete",
      elapsedHours: 2,
      leaderDamage: 0,
      guardLoss: 0,
      cartDamage: 0,
      cargoLoss: 0,
      sealBroken: false,
      guardDamage: { [member.id]: 0 },
      guardExperience: { [member.id]: 1 },
      guardFormationExperience: { [member.id]: { hold: 1 } },
      leaderExperience: 3,
      leaderFormationExperience: { hold: 2 },
      formationSeconds: { advance: 1, hold: 12, horses: 0 },
      dominantFormation: "hold",
    };
    const next = applyBattleResult({ ...journeyGame, phase: "battle", pendingBattle }, result);
    expect(next.crew[0].formationExperience).toEqual({ advance: 0, hold: 1, horses: 0 });
    expect(next.leader.experience).toBe(3);
    expect(next.leader.formationExperience).toEqual({ advance: 0, hold: 2, horses: 0 });
    expect(next.news.some((item) => item.includes("战阵习练") && item.includes("围车结阵"))).toBe(true);
  });
});
