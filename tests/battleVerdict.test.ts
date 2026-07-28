import { describe, expect, it } from "vitest";
import { battleDefenseVerdictFromCue } from "../src/battle/momentPresentation";
import type { BattleCue } from "../src/battle/simulation";
import type { BattleConfig } from "../src/core/types";

const CONFIG: BattleConfig = {
  id: "battle-verdict",
  seed: 18,
  terrain: "mountain",
  danger: 72,
  objective: "护住车阵",
  enemyFaction: "测试山寨",
  routeName: "襄阳道",
  leader: { name: "沈砺", experience: 9, healthRatio: 1, power: 1.3, coreCombatFocusId: "cross-guard" },
  guards: [{ id: "lu-cang", name: "鲁沧", role: "副镖头", experience: 10, healthRatio: 1, power: 1.3 }],
};

const CUE: BattleCue = {
  id: 7,
  kind: "counter",
  sourceId: "bandit-chief",
  targetId: "player",
  fromX: 700,
  fromY: 230,
  toX: 280,
  toY: 280,
  amount: 4.2,
  counterAmount: 13.6,
  label: "交锋截阵",
  actionLabel: "踏阵挑战",
  targetLabel: "沈砺",
  assistSourceId: "lu-cang",
  ttl: 1,
  duration: 1,
};

describe("battle defense verdict presentation", () => {
  it("keeps the enemy move, player order, and core-pair result in one causal record", () => {
    expect(battleDefenseVerdictFromCue(CUE, "breakthrough", CONFIG)).toMatchObject({
      tone: "counter",
      seal: "截",
      title: "交锋截阵",
      incoming: "踏阵挑战",
      target: "沈砺",
      strategyLabel: "强行开路",
      strategySeal: "进",
      result: "实受 4",
      advice: "沈砺 × 鲁沧反击 14",
    });
  });

  it("names the missed order and recommends the matching defense after a breach", () => {
    const verdict = battleDefenseVerdictFromCue({
      ...CUE,
      id: 8,
      kind: "breach",
      targetId: "pack-horse",
      targetLabel: "马匹",
      actionLabel: "伏身斩缰",
      label: "马前失位",
      amount: 6.4,
      assistSourceId: undefined,
      counterAmount: undefined,
    }, "breakthrough", CONFIG);

    expect(verdict).toMatchObject({
      tone: "breach",
      seal: "破",
      title: "马前失位",
      strategyLabel: "强行开路",
      result: "承伤 6",
      advice: "下一招宜下「护住马匹」",
    });
  });

  it("does not turn ordinary attacks into strategy verdicts", () => {
    expect(battleDefenseVerdictFromCue({ ...CUE, kind: "player-strike" }, "balanced", CONFIG)).toBeNull();
  });
});
