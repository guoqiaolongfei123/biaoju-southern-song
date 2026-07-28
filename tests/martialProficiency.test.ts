import { describe, expect, it } from "vitest";
import { battleResult, createBattleSimulation, stepBattle } from "../src/battle/simulation";
import { createInitialLeader, normalizeLeaderProgression } from "../src/core/leaderContent";
import {
  createMartialProficiencyExperience,
  martialProficiencyExperienceGain,
  martialProficiencyRank,
  martialProficiencyTuning,
  normalizeMartialProficiencyExperience,
} from "../src/core/martialProficiencyContent";
import type { BattleConfig } from "../src/core/types";

const GUARDS: BattleConfig["guards"] = [
  { id: "deputy", name: "鲁沧", role: "副镖头", healthRatio: 1, power: 1.2 },
];

describe("总镖头武学熟练", () => {
  it("为三门武学分别建档，并能补全旧存档缺失项", () => {
    expect(createMartialProficiencyExperience()).toEqual({
      "guard-spear": 0,
      "severing-sabre": 0,
      "binding-hands": 0,
    });
    expect(normalizeMartialProficiencyExperience({ "guard-spear": 8, "binding-hands": -4 })).toEqual({
      "guard-spear": 8,
      "severing-sabre": 0,
      "binding-hands": 0,
    });
    expect(normalizeLeaderProgression({ name: "沈砺", martialExperience: { "severing-sabre": 15 } }).martialExperience).toEqual({
      "guard-spear": 0,
      "severing-sabre": 15,
      "binding-hands": 0,
    });
    expect(createInitialLeader().martialExperience["guard-spear"]).toBe(0);
  });

  it("初窥、架势、得法与宗成会在固定武历门槛晋阶", () => {
    expect(martialProficiencyRank(0)).toMatchObject({ label: "初窥", level: 0, nextAt: 3 });
    expect(martialProficiencyRank(3)).toMatchObject({ label: "架势", level: 1, nextAt: 8 });
    expect(martialProficiencyRank(8)).toMatchObject({ label: "得法", level: 2, nextAt: 15 });
    expect(martialProficiencyRank(15)).toMatchObject({ label: "宗成", level: 3, nextAt: null });
  });

  it("三门武学除通用攻防成长外仍保留各自专精", () => {
    const spear = martialProficiencyTuning("guard-spear", 15);
    const sabre = martialProficiencyTuning("severing-sabre", 15);
    const binding = martialProficiencyTuning("binding-hands", 15);
    expect(spear.techniqueRangeBonus).toBeGreaterThan(binding.techniqueRangeBonus);
    expect(sabre.specialistMultiplier).toBeGreaterThan(1);
    expect(binding.controlBonus).toBeGreaterThan(spear.controlBonus);
    expect(binding.extraTargets).toBeGreaterThan(0);
    expect(sabre.attackDamageMultiplier).toBeGreaterThan(1);
    expect(sabre.techniqueCooldownMultiplier).toBeLessThan(1);
  });

  it("实战出过绝技才增长武历，多次施展与斩将会追加记功", () => {
    expect(martialProficiencyExperienceGain(0, true)).toBe(0);
    expect(martialProficiencyExperienceGain(1, false)).toBe(1);
    expect(martialProficiencyExperienceGain(2, false)).toBe(2);
    expect(martialProficiencyExperienceGain(4, true)).toBe(4);
  });

  it("宗成快刀会比初窥快刀造成更高绝技伤害、回转更快，并写入战果武历", () => {
    const makeBattle = (martialArtExperience: number) => createBattleSimulation({
      id: `martial-proficiency-${martialArtExperience}`,
      seed: 52,
      terrain: "mountain",
      danger: 55,
      objective: "护车",
      martialArtId: "severing-sabre",
      enemyFaction: "测试山寨",
      routeName: "测试山路",
      leader: { name: "沈砺", experience: 8, healthRatio: 1, power: 1.2, martialArtExperience },
      guards: GUARDS,
    });
    const novice = makeBattle(0);
    const master = makeBattle(15);
    for (const battle of [novice, master]) {
      const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
      for (const enemy of battle.enemies) enemy.hp = enemy === cutter ? 500 : 0;
      cutter.maxHp = 500;
      cutter.x = battle.player.x + 150;
      cutter.y = battle.player.y;
      stepBattle(battle, { x: 0, y: 0, attack: false, technique: true, rally: false, retreat: false }, .05);
    }
    expect(master.leaderContribution.damage).toBeGreaterThan(novice.leaderContribution.damage);
    expect(master.techniqueCooldown).toBeLessThan(novice.techniqueCooldown);
    expect(master.techniqueCount).toBe(1);
    master.outcome = "complete";
    expect(battleResult(master).leaderMartialExperience).toEqual({ "severing-sabre": 1 });
  });
});
