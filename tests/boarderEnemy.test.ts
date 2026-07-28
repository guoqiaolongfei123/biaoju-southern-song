import { describe, expect, it } from "vitest";
import {
  battleAttackIntents,
  battleThreatNotice,
  createBattleSimulation,
  stepBattle,
  type BattleInput,
  type BattleSimulation,
} from "../src/battle/simulation";
import type { BattleConfig } from "../src/core/types";

const BASE_CONFIG: BattleConfig = {
  id: "boarder-test",
  seed: 1208,
  terrain: "mountain",
  danger: 44,
  objective: "护住货封",
  objectiveMode: "breakthrough",
  objectiveSeconds: 80,
  enemyFaction: "试阵山寨",
  routeName: "京西山道",
  leader: { name: "沈砺", experience: 8, healthRatio: 1, power: .05 },
  guards: [],
};

const input = (formation: "advance" | "hold"): BattleInput => ({
  x: 0,
  y: 0,
  attack: false,
  technique: false,
  rally: false,
  retreat: false,
  formation,
  strategy: formation === "hold" ? "guard-cart" : "balanced",
});

function isolateBoarder(state: BattleSimulation) {
  const boarder = state.enemies.find((enemy) => enemy.type === "boarder");
  if (!boarder) throw new Error("test fixture did not spawn a boarder");
  for (const enemy of state.enemies) if (enemy !== boarder) enemy.hp = 0;
  boarder.hp = 400;
  boarder.maxHp = 400;
  boarder.x = state.cart.x + 38;
  boarder.y = state.cart.y;
  boarder.cooldown = 0;
  state.player.x = 30;
  state.player.y = 70;
  state.player.cooldown = 999;
  state.elapsed = 3;
  return boarder;
}

function stepUntil(state: BattleSimulation, battleInput: BattleInput, predicate: () => boolean, maxSteps = 160): void {
  for (let step = 0; step < maxSteps && !predicate(); step += 1) stepBattle(state, battleInput, .05);
  expect(predicate()).toBe(true);
}

describe("攀车者两阶段威胁", () => {
  it("在常规护车战生成，并提前公开攀车目标与围车建议", () => {
    const state = createBattleSimulation(BASE_CONFIG);
    const boarder = isolateBoarder(state);
    stepBattle(state, input("advance"), .05);

    expect(boarder.attackWindup).toBeGreaterThan(0);
    expect(battleAttackIntents(state)).toContainEqual(expect.objectContaining({
      enemyId: boarder.id,
      actionLabel: "翻篷攀车",
      targetLabel: "镖车",
      recommendedStrategy: "guard-cart",
    }));
    expect(battleThreatNotice(state)).toMatchObject({ tone: "cart", advice: "立即围车固守" });
  });

  it("失去围车掩护时先攀上车尾，随后撬封造成显著货损", () => {
    const state = createBattleSimulation(BASE_CONFIG);
    const boarder = isolateBoarder(state);
    const advance = input("advance");

    stepUntil(state, advance, () => state.defenseBreaches >= 1);
    const cargoAfterBoarding = state.cart.cargo;
    expect(boarder.boarded).toBe(true);
    expect(cargoAfterBoarding).toBeGreaterThan(99);
    expect(state.cues.some((cue) => cue.kind === "breach" && cue.actionLabel === "翻篷攀车" && cue.label === "车尾失守")).toBe(true);

    stepUntil(state, advance, () => state.defenseBreaches >= 2);
    expect(boarder.boarded).toBe(true);
    expect(cargoAfterBoarding - state.cart.cargo).toBeGreaterThan(4);
    expect(state.cues.some((cue) => cue.kind === "breach" && cue.actionLabel === "撬封夺货" && cue.label === "货封被撬")).toBe(true);
  });

  it("围车时由车把式和固轮挠钩自动掀落攀车者", () => {
    const state = createBattleSimulation({
      ...BASE_CONFIG,
      guards: [{
        id: "driver-he",
        name: "何胜",
        role: "车把式",
        experience: 8,
        healthRatio: 1,
        power: 1,
        equipmentIds: ["wheel-hook"],
      }],
    });
    const boarder = isolateBoarder(state);
    const driver = state.guards[0];
    driver.x = state.cart.x - 135;
    driver.y = state.cart.y;
    driver.cooldown = 999;
    driver.supportCooldown = 999;
    const cargoBefore = state.cart.cargo;

    stepUntil(state, input("hold"), () => state.defenseCounters >= 1);

    expect(boarder.boarded).toBe(false);
    expect(boarder.stunned).toBeGreaterThan(0);
    expect(state.cart.cargo).toBe(cargoBefore);
    expect(state.guardContributions[driver.id].support).toBeGreaterThan(0);
    expect(state.cues.some((cue) => cue.kind === "brace" && cue.sourceId === driver.id && cue.label?.includes("固轮挠钩"))).toBe(true);
    expect(state.cues.some((cue) => cue.kind === "counter" && cue.actionLabel === "翻篷攀车" && cue.label === "围车掀贼")).toBe(true);
  });
});
