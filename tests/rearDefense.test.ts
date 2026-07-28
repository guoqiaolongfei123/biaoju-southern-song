import { describe, expect, it } from "vitest";
import {
  attackApproach,
  autoBattleInput,
  battleRearThreatStatus,
  battleThreatNotice,
  createBattleSimulation,
  stepBattle,
  type BattleInput,
  type BattleSimulation,
} from "../src/battle/simulation";
import type { BattleConfig } from "../src/core/types";

const CONFIG: BattleConfig = {
  id: "rear-defense-test",
  seed: 1208,
  terrain: "official",
  danger: 44,
  objective: "检验身后判定",
  objectiveMode: "holdout",
  objectiveSeconds: 40,
  enemyFaction: "试阵敌手",
  routeName: "临安官道",
  leader: { name: "沈砺", experience: 9, healthRatio: 1, power: 1.1 },
  guards: [{ id: "deputy", name: "陆青禾", role: "副镖头", experience: 9, healthRatio: 1, power: 1.2 }],
};

const idleInput = (): BattleInput => ({
  x: 0,
  y: 0,
  attack: false,
  technique: false,
  rally: false,
  retreat: false,
  formation: "hold",
  strategy: "balanced",
});

function onlyEnemy(state: BattleSimulation, index = 0) {
  const enemy = state.enemies[index];
  for (const other of state.enemies) if (other !== enemy) other.hp = 0;
  enemy.type = "raider";
  enemy.carrier = false;
  enemy.stunned = 0;
  return enemy;
}

describe("自动战斗身后判定", () => {
  it("按人物朝向区分正面、侧面与背后", () => {
    const state = createBattleSimulation(CONFIG);
    state.player.x = 200;
    state.player.y = 200;
    state.player.facingX = 1;
    state.player.facingY = 0;

    expect(attackApproach(state.player, { x: 260, y: 200 })).toBe("front");
    expect(attackApproach(state.player, { x: 200, y: 140 })).toBe("flank");
    expect(attackApproach(state.player, { x: 140, y: 200 })).toBe("rear");
  });

  it("停步时也锁定背后近敌并自动回身", () => {
    const state = createBattleSimulation(CONFIG);
    const enemy = onlyEnemy(state);
    enemy.x = state.player.x - 58;
    enemy.y = state.player.y;

    const input = autoBattleInput(state, "balanced");
    expect(input.targetEnemyId).toBe(enemy.id);
    expect(input.x).toBe(0);
    stepBattle(state, input, .05);

    expect(state.player.facingX).toBeLessThan(-.95);
    expect(state.rearTurnCount).toBe(1);
    expect(state.rearResponseTargetId).toBe(enemy.id);
    expect(state.cues.some((cue) => cue.kind === "rear-turn")).toBe(true);
  });

  it("三面受敌时选择空隙侧退，但仍正面盯住威胁", () => {
    const state = createBattleSimulation(CONFIG);
    const positions = [
      { x: state.player.x - 54, y: state.player.y },
      { x: state.player.x + 54, y: state.player.y },
      { x: state.player.x, y: state.player.y - 62 },
      { x: state.player.x, y: state.player.y + 62 },
    ];
    state.enemies.forEach((enemy, index) => {
      if (!positions[index]) enemy.hp = 0;
      else {
        enemy.type = "raider";
        enemy.x = positions[index].x;
        enemy.y = positions[index].y;
      }
    });

    const status = battleRearThreatStatus(state);
    const input = autoBattleInput(state, "balanced");
    expect(status.surrounded).toBe(true);
    expect(Math.hypot(input.x, input.y)).toBeGreaterThan(.9);
    const target = state.enemies.find((enemy) => enemy.id === input.targetEnemyId)!;
    stepBattle(state, input, .05);
    expect(attackApproach(state.player, target)).toBe("front");
    expect(battleThreatNotice(state).label).toContain("三面受敌");
  });

  it("副镖头在近侧会封住背袭、减伤并反打", () => {
    const state = createBattleSimulation(CONFIG);
    const enemy = onlyEnemy(state);
    enemy.x = state.player.x - 34;
    enemy.y = state.player.y;
    enemy.cooldown = 0;
    enemy.attackTargetId = state.player.id;
    enemy.attackWindup = .01;
    enemy.attackWindupDuration = .01;
    state.elapsed = 3;
    state.player.cooldown = 99;
    const hpBefore = state.player.hp;
    const enemyHpBefore = enemy.hp;

    stepBattle(state, idleInput(), .05);

    expect(hpBefore - state.player.hp).toBeCloseTo(3, 4);
    expect(enemy.hp).toBeLessThan(enemyHpBefore);
    expect(state.rearGuardCount).toBe(1);
    expect(state.rearHitCount).toBe(0);
    expect(state.cues.some((cue) => cue.kind === "rear-guard")).toBe(true);
  });

  it("无人封背时背袭会明确记账，并立即把人物转向来敌", () => {
    const state = createBattleSimulation({ ...CONFIG, id: "rear-hit-test", guards: [] });
    const enemy = onlyEnemy(state);
    enemy.x = state.player.x - 34;
    enemy.y = state.player.y;
    enemy.attackTargetId = state.player.id;
    enemy.attackWindup = .01;
    enemy.attackWindupDuration = .01;
    state.elapsed = 3;
    state.player.cooldown = 99;
    const hpBefore = state.player.hp;

    stepBattle(state, idleInput(), .05);

    expect(hpBefore - state.player.hp).toBeCloseTo(7.08, 4);
    expect(state.rearHitCount).toBe(1);
    expect(state.player.facingX).toBeLessThan(-.95);
    expect(state.cues.some((cue) => cue.kind === "rear-hit")).toBe(true);
  });
});
